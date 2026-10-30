<?php
require_once __DIR__ . '/../../../includes/auth.php';
requireRole(['admin']); // Audit trail is strictly admin-only, regardless of permissions.php
$pdo = getDB();

$logs = $pdo->query("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200")->fetchAll();
$pageTitle = 'Audit Trail';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Audit Trail <small style="color:#888;font-weight:normal">(Admin only — last 200 events)</small></h2>
<div class="table-wrap">
<table>
<tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>Details</th><th>IP</th></tr>
<?php foreach ($logs as $l): ?>
<tr>
    <td><?= htmlspecialchars($l['created_at']) ?></td>
    <td><?= htmlspecialchars($l['username']) ?></td>
    <td><?= htmlspecialchars($l['action']) ?></td>
    <td><?= htmlspecialchars($l['module']) ?></td>
    <td><?= $l['record_id'] ? '#'.$l['record_id'] : '-' ?></td>
    <td><?= htmlspecialchars($l['details']) ?></td>
    <td><?= htmlspecialchars($l['ip_address']) ?></td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
