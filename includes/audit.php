<?php
require_once __DIR__ . '/../config/config.php';

function logAction(string $action, string $module, ?int $recordId, string $details = ''): void {
    $pdo = getDB();
    $user = $_SESSION['user'] ?? null;
    // Callers must not include diagnoses, identifiers, passwords, tokens, or patient-sensitive content.
    $details = substr(trim($details), 0, 1000);
    $ip = filter_var($_SERVER['REMOTE_ADDR'] ?? '', FILTER_VALIDATE_IP) ? $_SERVER['REMOTE_ADDR'] : null;
    $stmt = $pdo->prepare("INSERT INTO audit_log (user_id, username, action, module, record_id, details, ip_address) VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([
        $user['id'] ?? null,
        $user['username'] ?? 'system',
        substr($action, 0, 50),
        substr($module, 0, 50),
        $recordId,
        $details,
        $ip,
    ]);
}
