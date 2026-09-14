$ErrorActionPreference = "Stop"

$ports = 8080, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009
$pids = foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess
}

$uniquePids = $pids | Sort-Object -Unique

if (-not $uniquePids) {
  Write-Host "No native Barangay Health ports are listening."
  exit 0
}

foreach ($processId in $uniquePids) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  Write-Host "Stopping PID $processId ($($process.ProcessName))"
  Stop-Process -Id $processId -Force
}

Write-Host "Native stack ports are stopped."
