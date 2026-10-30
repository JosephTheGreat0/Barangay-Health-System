<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../config/config.php';

$username = getenv('BHIMS_ADMIN_USERNAME') ?: '';
$password = getenv('BHIMS_ADMIN_PASSWORD') ?: '';
$fullName = getenv('BHIMS_ADMIN_NAME') ?: '';
if (!preg_match('/^[A-Za-z0-9_.-]{4,50}$/', $username) ||
    strlen($password) < 14 || strlen($password) > 200 ||
    trim($fullName) === '' || strlen($fullName) > 150) {
    fwrite(STDERR, "Set BHIMS_ADMIN_USERNAME (4-50 safe characters), BHIMS_ADMIN_PASSWORD (14+ characters), and BHIMS_ADMIN_NAME.\\n");
    exit(1);
}
$pdo = getDB();
$role = $pdo->prepare("SELECT id FROM roles WHERE name='admin' LIMIT 1");
$role->execute();
$roleId = $role->fetchColumn();
if (!$roleId) {
    fwrite(STDERR, "Admin role missing. Import database/schema.sql first.\\n");
    exit(1);
}
$exists = $pdo->prepare('SELECT id FROM users WHERE username=?');
$exists->execute([$username]);
if ($exists->fetch()) {
    fwrite(STDERR, "That username already exists.\\n");
    exit(1);
}
$hash = password_hash($password, PASSWORD_DEFAULT);
$insert = $pdo->prepare("INSERT INTO users (username,password_hash,role_id,full_name,status) VALUES (?,?,? ,?,'active')");
$insert->execute([$username, $hash, $roleId, trim($fullName)]);
fwrite(STDOUT, "Administrator account created. Remove the environment variables from your shell/session.\\n");
