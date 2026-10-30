<?php
require_once __DIR__ . '/../includes/auth.php';
requireLogin();
$pdo = getDB();
$user = currentUser();
$pageTitle = 'Dashboard';
require __DIR__ . '/../includes/header.php';

// Pull only the stats relevant to modules this role can see
$permissions = require __DIR__ . '/../config/permissions.php';
$allowed = $user['role'] === 'admin' ? ['patients','appointments','staff','payroll','financial','inventory','referral'] : ($permissions[$user['role']] ?? []);

$stats = [];
if (in_array('patients', $allowed)) {
    $stats['Total Patients'] = $pdo->query("SELECT COUNT(*) c FROM patients")->fetch()['c'];
}
if (in_array('appointments', $allowed)) {
    $stats["Today's Queue"] = $pdo->query("SELECT COUNT(*) c FROM appointments WHERE scheduled_date = CURDATE() AND status IN ('waiting','in-consultation')")->fetch()['c'];
}
if (in_array('inventory', $allowed)) {
    $stats['Low Stock Items'] = $pdo->query("SELECT COUNT(*) c FROM inventory_items WHERE quantity_on_hand <= reorder_level")->fetch()['c'];
}
if (in_array('referral', $allowed)) {
    $stats['Pending Referrals'] = $pdo->query("SELECT COUNT(*) c FROM referrals WHERE status = 'pending'")->fetch()['c'];
}
if (in_array('staff', $allowed)) {
    $stats['Active Staff'] = $pdo->query("SELECT COUNT(*) c FROM staff WHERE status='active'")->fetch()['c'];
}
if (in_array('payroll', $allowed)) {
    $stats['Draft Payrolls'] = $pdo->query("SELECT COUNT(*) c FROM payroll WHERE status='draft'")->fetch()['c'];
}
if (in_array('financial', $allowed)) {
    $bal = $pdo->query("SELECT COALESCE(SUM(CASE WHEN txn_type='income' THEN amount ELSE -amount END),0) b FROM financial_transactions")->fetch()['b'];
    $stats['Fund Balance'] = '₱' . number_format($bal, 2);
}
?>
<h2>Welcome, <?= htmlspecialchars($user['full_name']) ?></h2>
<p>Role: <strong><?= htmlspecialchars($user['role']) ?></strong> — you can only access the modules listed in the sidebar.</p>

<div class="grid">
    <?php foreach ($stats as $label => $value): ?>
    <div class="stat">
        <h3><?= htmlspecialchars($value) ?></h3>
        <p><?= htmlspecialchars($label) ?></p>
    </div>
    <?php endforeach; ?>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
