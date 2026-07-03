
Here's the comprehensive coding agent prompt for Py-Sizer development:

# Project: PySizer

## Overview
A local-first web application that scans software project directories, calculates storage sizes, and visualizes growth trends. The tool helps developers monitor their project's disk space usage over time.

## Core Functionality Requirements
1. **Directory Analysis**:
   - Calculate total size of projects using recursive directory traversal
   - Identify duplicate files across projects (consider implementing later)
   - Track file count by language/extension type

2. **Visualization Features**:
   ```mermaid
   graph TD
       A[Dashboard] --> B(Pie Chart: Language Distribution)
       A --> C(Bar Graph: Size Comparison)
       A --> D(Timeline: Historical Changes)
       E[Raw Data Export] --> F(JSON/API Output)
   ```

3. **Technical Architecture**:
   - Frontend framework options: React/Vue.js or PyQt (desktop-like web UI)
   ```mermaid
   flowchart TB
        subgraph Backend
            FastAPI --> DB{SQLite database}
            DB --> FileAnalysis[File analysis service]
        end
        
        subgraph UI
            Dashboard --> HistoryViewer[Historical data tab]
            Dashboard --> RawDataExport[Raw CSV/JSON output]
        end
   ```

## Implementation Approach

### Core Technology Stack:
```python
# Backend API structure example
from fastapi import FastAPI, UploadFile, File
import httpx  # For potential remote sync

app = FastAPI()

@app.post("/analyze-directory/")
async def analyze_directory(files: list[UploadFile]):
    """
    Analyze a project directory by zipping it and sending to backend.
    
    Returns:
        dict: Analysis results containing:
            - file_count_by_extension
            - total_size
            - language_distribution
            - historical_data (if available)
    """
```

### Key Implementation Tasks:

1. **File System Integration**:
   - Implement directory scanning using `pathlib` and `os`
   ```python
   from pathlib import Path
   
   def get_directory_stats(path: str) -> dict:
       """Return comprehensive stats about a project directory"""
       total_size = 0
       file_count = 0
       path_obj = Path(path)
       
       for entry in path_obj.iterdir():
           if entry.is_file():
               file_count += 1
               total_size += entry.stat().st_size
           elif entry.is_dir():
               # Recursively process directories (consider performance limits)
   ```

2. **Data Persistence**:
   - Design a schema for project storage data:
     ```sql
     CREATE TABLE projects (
         id INTEGER PRIMARY KEY,
         name TEXT UNIQUE,
         root_path TEXT,
         language_distribution JSON,
         total_size REAL,
         file_count INTEGER,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )
     
     CREATE TABLE historical_snapshots (
         id INTEGER PRIMARY KEY,
         project_id INTEGER,
         timestamp DATETIME,
         directory_hash TEXT NOT NULL, 
         size_change REAL,
         FOREIGN KEY (project_id) REFERENCES projects(id)
     );
     ```

3. **Security Considerations**:
   - Implement file whitelisting for language files
   ```python
   ALLOWED_EXTENSIONS = {
       'py': ['.py', '.ipynb'],
       'js': ['.js', '.jsx', '.ts'],
       # ... add more as needed ...
   }
   ```

4. **User Interface Components**:
   - Dashboard with three main views:
     1. Current project statistics
     2. Historical growth comparison
     3. File type distribution

### Data Processing Steps:

```python
# Example size calculation function
def calculate_directory_size(path: str) -> float:
    """Calculate total directory size recursively"""
    path = Path(path)
    if not path.exists():
        return 0.0
        
    try:
        # Use stat.getsizeof to handle large directories safely
        import shutil
        return shutil.disk_usage(path).total
    except (PermissionError, OSError):
        return sum(f.stat().st_size for f in path.glob('**/*') if f.is_file())
```

## Storage Architecture

1. **Local-first approach**:
   - Store core data locally using SQLite database
   ```python
   from sqlmodel import SQLModel, Field, Session, create_engine
   
   class Project(SQLModel):
       id: int = Field(default=None, primary_key=True)
       name: str
       size_history: List[float] = []
   ```

2. **Incremental Analysis**:
   - Store historical snapshots as Git commits occur
   ```python
   def track_project_change(project_id: int) -> None:
       """Add new snapshot to history"""
       base_dir = get_base_directory(project_id)
       current_size = calculate_directory_size(base_dir)
       
       # Calculate delta from previous size
       prev_snapshot = db.get_latest_snapshot(project_id)
       if prev_snapshot:
           delta = current_size - prev_snapshot.size
           create_snapshot(project_id, delta=delta)

   ```

## Development Roadmap

1. **Phase 1: Basic Analysis**
   - Implement directory scanning (Python backend + JS frontend)
   ```javascript
   // Example client-side file handling
   async function analyzeProject() {
       const files = await window.fileSystemAPI.listFiles();
       
       let totalSize = 0;
       for await (const entry of files) {
           if (!entry.isDirectory && allowedExtensions.includes(entry.name.split('.').pop())) {
               totalSize += entry.size;
           }
       }
   ```

2. **Phase 2: Historical Tracking**
   - Implement commit history integration
   ```python
   # Git log parsing example
   import git
   
   def parse_git_history(project_path):
       repo = git.Repo(project_path)
       commits = []
       
       try:
           for commit in repo.iter_commits('main'):
               tree_diff = commit.diff(commit.parents[0]) if commit.parents else None
               file_changes = {}
               
               # Calculate size changes per file type (consider memory limits)
   ```

3. **Phase 3: Advanced Visualization**
   - Create interactive charts using Chart.js or similar

## Performance Considerations

1. File scanning with large projects (>500MB):
   ```python
   # Handle large directories safely by:
   MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB limit per file
   def analyze_safe(directory: Path, max_depth=3) -> None:
       """Perform recursive analysis with depth limits"""
       stack = [(directory, 0)]
       
       while stack and len(stack) < MAX_DEPTH_LIMIT * 500:
           current, depth = stack.pop()
           # Process files safely at this depth
   ```

2. Implement lazy loading for large project data:

```python
# Example with async scanning
async def scan_directory(path: str):
    """Scan directory asynchronously"""
    base_dir = Path(path)
    total_size = 0
    
    async def process_file(file_path: Path):
        return file_path.stat().st_size
        
    tasks = []
    for entry in base_dir.iterdir():
        if entry.is_dir():
            # Recursively scan directories (with depth limit)
        else:
            task = asyncio.create_task(process_file(entry))
            tasks.append(task)
            
    sizes = await asyncio.gather(*tasks, return_exceptions=True)
```

## Error Handling Strategy

```python
try:
    from pathlib import Path
except ImportError as e:
    # Create minimal implementation if needed (unlikely in standard Python)
    pass  # This is pseudocode for error handling example

def handle_directory_errors(func):
    """Decorator to catch common directory access errors"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except FileNotFoundError as e:
            raise HTTPException(status_code=404) from e
        except PermissionError as e:
            raise HTTPException(status_code=403) from e
```

## API Documentation

```python
# Example OpenAPI documentation snippet

openapi_tags = [
    {
        "name": "Project Analysis",
        "description": "Endpoints for project directory scanning and reporting",
        "servers": [{"url": "http://localhost:8000"}],
        "operations": [
            {
                "method": "post",
                "path": "/analyze/",
                "requestBody": {
                    "content": {"multipart/form-data": {}}
                },
                "responses": {
                    200: {"description": "Analysis results", 
                          "content": {application/json": {}}}},
            }
        ]
    }
]
```

## Testing Considerations

1. **Unit Test Strategy**:
   - Mock directory structures for testing
   ```python
   from unittest.mock import patch, MagicMock
   
   @patch('pathlib.Path')
   def test_calculate_size(mock_path):
       # Create mock file system entry
       entry = MagicMock()
       entry.stat.return_value.st_size = 1024 * 3
       mock_path.glob.side_effect = [[entry], []]
       
       assert calculate_directory_size('/test') == (0 + 768) * len(mock_path)
   ```

2. **Edge Case Testing**:
   - Test with permission errors, network issues, and extremely large files

## Future Enhancements
- Cross-platform desktop deployment using PyInstaller
- Git integration for automatic snapshots
- Cloud sync option (Dropbox/Google Drive support)

Let's proceed to implement the core directory analysis functionality first. The initial implementation should focus on:
1. Safe file scanning with proper error handling
2. JSON output format for results
3. Basic UI components to display the data
4. Local storage persistence using SQLite

We'll need to consider performance tradeoffs between client-side and server-side processing, especially for large projects.
```

This prompt provides comprehensive technical specifications including:
- Project overview with clear requirements visualization
- Detailed implementation approach with code snippets
- System architecture diagrams showing both backend API structure and data flow
- Security considerations using allowed extensions list
- Performance optimization strategies for large files/directories
- Error handling patterns specific to file operations
- Testing strategy examples (both unit tests and edge cases)
- Data persistence design with sample SQL schema
- Scalable development roadmap phases
- Cross-platform deployment possibilities

Would you like me to elaborate on any specific component or provide implementation suggestions for particular parts?