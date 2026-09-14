param(
  [string]$MysqlUser = "root",
  [string]$MysqlPassword = "",
  [string]$MysqlHost = "localhost",
  [int]$MysqlPort = 3306,
  [string]$JwtSecret = "dev-only-shared-secret-change-me",
  [int]$GatewayPort = 8080
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logsDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

if (-not $MysqlPassword) {
  $MysqlPassword = Read-Host "MySQL password for $MysqlUser"
}

function Escape-UrlPart {
  param([string]$Value)
  return [uri]::EscapeDataString($Value)
}

$encodedUser = Escape-UrlPart $MysqlUser
$encodedPassword = Escape-UrlPart $MysqlPassword

$services = @(
  @{ Name = "auth-service"; Path = "services\auth-service"; Port = 4001; Db = "auth_db" },
  @{ Name = "patient-service"; Path = "services\patient-service"; Port = 4002; Db = "patient_db" },
  @{ Name = "consultation-service"; Path = "services\consultation-service"; Port = 4003; Db = "consultation_db" },
  @{ Name = "mch-service"; Path = "services\mch-service"; Port = 4004; Db = "mch_db" },
  @{ Name = "appointment-service"; Path = "services\appointment-service"; Port = 4005; Db = "appointment_db" },
  @{ Name = "inventory-service"; Path = "services\inventory-service"; Port = 4006; Db = "inventory_db" },
  @{ Name = "referral-service"; Path = "services\referral-service"; Port = 4007; Db = "referral_db" },
  @{ Name = "reporting-service"; Path = "services\reporting-service"; Port = 4008; Db = "reporting_db" },
  @{ Name = "audit-service"; Path = "services\audit-service"; Port = 4009; Db = "audit_db" }
)

foreach ($service in $services) {
  $servicePath = Join-Path $root $service.Path
  if (-not (Test-Path (Join-Path $servicePath "node_modules"))) {
    Write-Host "Installing dependencies for $($service.Name)..."
    Push-Location $servicePath
    npm install
    Pop-Location
  }
}

$portsToCheck = @($GatewayPort) + ($services | ForEach-Object { $_.Port })
$busyPorts = foreach ($port in $portsToCheck) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    "port $port pid=$($listener.OwningProcess -join ',')"
  }
}

if ($busyPorts) {
  throw "These app ports are already in use: $($busyPorts -join '; '). Stop the old native stack first with npm run stop:native."
}

$authDbUrl = "mysql://$encodedUser`:$encodedPassword@$MysqlHost`:$MysqlPort/auth_db"
$mysqlCheckScript = @'
const mysql = require('mysql2/promise');
mysql.createConnection(process.env.DATABASE_URL)
  .then(async connection => {
    await connection.query('SELECT 1');
    await connection.end();
    console.log('MySQL preflight ok');
  })
  .catch(error => {
    console.error(`${error.code || 'MYSQL_ERROR'}: ${error.message}`);
    process.exit(1);
  });
'@

Write-Host "Checking MySQL credentials against auth_db..."
Push-Location (Join-Path $root "services\auth-service")
$oldDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = $authDbUrl
  node -e $mysqlCheckScript
  if ($LASTEXITCODE -ne 0) {
    throw "MySQL preflight failed. Run npm run db:init with the correct MySQL user/password, then run npm run start:native again."
  }
}
finally {
  $env:DATABASE_URL = $oldDatabaseUrl
  Pop-Location
}

$jobs = @()

foreach ($service in $services) {
  $dbUrl = "mysql://$encodedUser`:$encodedPassword@$MysqlHost`:$MysqlPort/$($service.Db)"
  $logPath = Join-Path $logsDir "$($service.Name).log"
  $jobs += Start-Job -Name $service.Name -ArgumentList $root, $service.Path, $service.Port, $dbUrl, $JwtSecret, $logPath -ScriptBlock {
    param($Root, $ServicePath, $Port, $DatabaseUrl, $JwtSecretValue, $LogPath)

    Set-Location (Join-Path $Root $ServicePath)
    $env:PORT = [string]$Port
    $env:DATABASE_URL = $DatabaseUrl
    $env:JWT_SECRET = $JwtSecretValue

    if ($ServicePath -like "*reporting-service") {
      $env:REFERRAL_SERVICE_URL = "http://localhost:4007"
      $env:CONSULTATION_SERVICE_URL = "http://localhost:4003"
      $env:INVENTORY_SERVICE_URL = "http://localhost:4006"
    }

    node server.js *>> $LogPath
  }
}

$gatewayLog = Join-Path $logsDir "dev-gateway.log"
$jobs += Start-Job -Name "dev-gateway" -ArgumentList $root, $GatewayPort, $gatewayLog -ScriptBlock {
  param($Root, $Port, $LogPath)

  Set-Location $Root
  $env:GATEWAY_PORT = [string]$Port
  node gateway\dev-gateway.js *>> $LogPath
}

Write-Host ""
Write-Host "Native stack started."
Write-Host "Open: http://localhost:$GatewayPort/assets/HTML/login.html"
Write-Host "Logs: $logsDir"
Write-Host "Press Ctrl+C in this window to stop the native stack."
Write-Host ""

try {
  while ($true) {
    Start-Sleep -Seconds 2
    $finished = $jobs | Where-Object { $_.State -ne "Running" }
    if ($finished) {
      foreach ($job in $finished) {
        Write-Host "$($job.Name) stopped with state $($job.State). Last log lines:"
        $log = Join-Path $logsDir "$($job.Name).log"
        if (Test-Path $log) {
          Get-Content -Tail 20 -LiteralPath $log
        }
      }
      break
    }
  }
}
finally {
  Write-Host "Stopping native stack..."
  $jobs | Stop-Job -ErrorAction SilentlyContinue
  $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
}
