<?php
declare(strict_types=1);

// BHIMS configuration. Production secrets must be supplied through environment variables.
define('APP_NAME', 'Barangay Health Information & Management System');
define('APP_ENV', getenv('APP_ENV') ?: 'development');
define('DB_HOST', getenv('DB_HOST') ?: 'db');
define('DB_NAME', getenv('DB_NAME') ?: 'bhims');
define('DB_USER', getenv('DB_USER') ?: 'bhims_user');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('APP_KEY', getenv('APP_KEY') ?: '');

if (APP_ENV === 'production') {
    if (DB_PASS === '' || in_array(DB_PASS, ['change_me', 'password', 'root'], true)) {
        http_response_code(500);
        exit('Application configuration error.');
    }
    if (strlen(getenv('APP_KEY') ?: '') < 32) {
        http_response_code(500);
        exit('Application configuration error.');
    }
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

// Do not trust forwarded headers from arbitrary clients. TLS is detected directly here;
// terminate TLS at the trusted proxy and set HTTPS in production.
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
if (APP_ENV === 'production' && $isHttps) {
    // Cloudflare deployments should enforce HTTPS at the edge as well.
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'");

if (APP_ENV === 'production') {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    session_name('BHIMSSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => APP_ENV === 'production' || $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
