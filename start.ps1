[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backendProcess = $null
$frontendProcess = $null
$exitCode = 0

function Stop-ProcessTree {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$Name
    )

    if ($null -eq $Process) {
        return
    }

    try {
        $Process.Refresh()
        if (-not $Process.HasExited) {
            Write-Host "Stopping $Name..."
            & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
        }
    }
    catch {
        Write-Warning "Could not stop $Name cleanly: $($_.Exception.Message)"
    }
}

$uvCommand = Get-Command uv -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
$npmCommand = Get-Command npm -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($null -eq $uvCommand) {
    Write-Error "The 'uv' command was not found. Install uv and complete project setup first."
    exit 1
}

if ($null -eq $npmCommand) {
    Write-Error "The 'npm' command was not found. Install Node.js and complete project setup first."
    exit 1
}

$repoRoot = $PSScriptRoot
$frontendDirectory = Join-Path $repoRoot "frontend"

try {
    Write-Host "Starting PySizer backend at http://127.0.0.1:8000..."
    $backendProcess = Start-Process `
        -FilePath $uvCommand.Source `
        -ArgumentList @(
            "run", "uvicorn", "app.main:app", "--app-dir", "backend",
            "--reload", "--host", "127.0.0.1", "--port", "8000"
        ) `
        -WorkingDirectory $repoRoot `
        -NoNewWindow `
        -PassThru

    Write-Host "Starting PySizer frontend..."
    $frontendProcess = Start-Process `
        -FilePath $npmCommand.Source `
        -ArgumentList @("run", "dev") `
        -WorkingDirectory $frontendDirectory `
        -NoNewWindow `
        -PassThru

    Write-Host "Both servers are running. Press Ctrl+C to stop them."

    while ($true) {
        Start-Sleep -Milliseconds 250
        $backendProcess.Refresh()
        $frontendProcess.Refresh()

        if ($backendProcess.HasExited) {
            $exitCode = $backendProcess.ExitCode
            Write-Host "Backend exited with code $exitCode."
            break
        }

        if ($frontendProcess.HasExited) {
            $exitCode = $frontendProcess.ExitCode
            Write-Host "Frontend exited with code $exitCode."
            break
        }
    }
}
catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    $exitCode = 1
}
finally {
    Stop-ProcessTree -Process $frontendProcess -Name "frontend"
    Stop-ProcessTree -Process $backendProcess -Name "backend"
}

exit $exitCode
