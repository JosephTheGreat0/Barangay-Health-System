<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/audit.php';

function currentUser(): ?array {
    return $_SESSION['user'] ?? null;
}

function csrfToken(): string {
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

function csrfField(): string {
    return '<input type="hidden" name="_csrf" value="' .
        htmlspecialchars(csrfToken(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">';
}

function verifyCsrfRequest(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return;
    }
    $provided = $_POST['_csrf'] ?? '';
    $expected = $_SESSION['_csrf'] ?? '';
    if (!is_string($provided) || !is_string($expected) ||
        $expected === '' || !hash_equals($expected, $provided)) {
        http_response_code(403);
        exit('Request rejected. Refresh the page and try again.');
    }
}

function requireLogin(): void {
    if (!currentUser()) {
        header('Location: /login.php');
        exit;
    }
}

function requireModule(string $module): void {
    requireLogin();
    verifyCsrfRequest();
    $user = currentUser();
    if ($user['role'] === 'admin') return;
    $permissions = require __DIR__ . '/../config/permissions.php';
    $allowed = $permissions[$user['role']] ?? [];
    if (!in_array($module, $allowed, true)) {
        http_response_code(403);
        exit('403 - Access denied.');
    }
}

function requireRole(array $roles): void {
    requireLogin();
    verifyCsrfRequest();
    $user = currentUser();
    if (!in_array($user['role'], $roles, true) && $user['role'] !== 'admin') {
        http_response_code(403);
        exit('403 - Access denied.');
    }
}

function login(string $username, string $password): bool {
    $pdo = getDB();
    $username = trim($username);
    if ($username === '' || strlen($username) > 50 || strlen($password) > 1024) {
        return false;
    }

    // Persistent throttling by client IP and normalized account name. Add login_attempts table from schema.sql.
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ipKey = hash_hmac('sha256', 'ip|' . $ip, APP_KEY ?: 'development-only');
    $accountKey = hash_hmac('sha256', 'account|' . strtolower($username), APP_KEY ?: 'development-only');
    $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)')->execute();
    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE attempt_key IN (?,?) AND attempted_at >= (NOW() - INTERVAL 15 MINUTE)');
    $countStmt->execute([$ipKey, $accountKey]);
    if ((int)$countStmt->fetchColumn() >= 10) {
        return false;
    }

    $stmt = $pdo->prepare("SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ? AND u.status = 'active'");
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if ($row && password_verify($password, $row['password_hash'])) {
        if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
            $rehash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$rehash, $row['id']]);
        }
        session_regenerate_id(true);
        $_SESSION = [];
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        $_SESSION['user'] = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'full_name' => $row['full_name'],
            'role' => $row['role_name'],
            'staff_id' => $row['staff_id'] !== null ? (int)$row['staff_id'] : null,
        ];
        $pdo->prepare('DELETE FROM login_attempts WHERE attempt_key IN (?,?)')->execute([$ipKey, $accountKey]);
        $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$row['id']]);
        logAction('LOGIN', 'auth', null, 'Successful login.');
        return true;
    }

    $attempt = $pdo->prepare('INSERT INTO login_attempts (attempt_key) VALUES (?)');
    $attempt->execute([$ipKey]);
    $attempt->execute([$accountKey]);
    logAction('LOGIN_FAILED', 'auth', null, 'Failed login attempt.');
    return false;
}

function logout(): void {
    if (currentUser()) {
        logAction('LOGOUT', 'auth', null, 'User logged out.');
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool)$params['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
}
