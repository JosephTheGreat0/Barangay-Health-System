<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('reports');
$pdo = getDB();
$user = currentUser();
$permissions = require __DIR__ . '/../../../config/permissions.php';
$allowed = $user['role'] === 'admin' ? ['patients','appointments','staff','payroll','financial','inventory','referral'] : ($permissions[$user['role']] ?? []);
logAction('VIEW','reports',null,'Viewed reports dashboard');

$pageTitle = 'Reports';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Reports</h2>
<p style="color:#666">Only sections relevant to your role are shown.</p>

<?php if (in_array('appointments',$allowed)): ?>
<div class="card">
    <h3>Patients Served (Last 30 Days)</h3>
    <?php
    $rows = $pdo->query("SELECT scheduled_date d, COUNT(*) c FROM appointments WHERE status='completed' AND scheduled_date >= CURDATE() - INTERVAL 30 DAY GROUP BY scheduled_date ORDER BY d DESC")->fetchAll();
    ?>
    <div class="table-wrap">
    <table><tr><th>Date</th><th>Patients Completed</th></tr>
    <?php foreach ($rows as $r): ?><tr><td><?= $r['d'] ?></td><td><?= $r['c'] ?></td></tr><?php endforeach; ?>
    <?php if (!$rows): ?><tr><td colspan="2">No completed visits yet.</td></tr><?php endif; ?>
    </table>
    </div>
</div>
<?php endif; ?>

<?php if (in_array('referral',$allowed)): ?>
<div class="card">
    <h3>Referrals by Status</h3>
    <?php $rows = $pdo->query("SELECT status, COUNT(*) c FROM referrals GROUP BY status")->fetchAll(); ?>
    <div class="table-wrap">
    <table><tr><th>Status</th><th>Count</th></tr>
    <?php foreach ($rows as $r): ?><tr><td><?= htmlspecialchars($r['status']) ?></td><td><?= $r['c'] ?></td></tr><?php endforeach; ?>
    </table>
    </div>
</div>
<?php endif; ?>

<?php if (in_array('inventory',$allowed)): ?>
<div class="card">
    <h3>Low Stock Items</h3>
    <?php $rows = $pdo->query("SELECT item_name, quantity_on_hand, reorder_level FROM inventory_items WHERE quantity_on_hand <= reorder_level")->fetchAll(); ?>
    <div class="table-wrap">
    <table><tr><th>Item</th><th>On Hand</th><th>Reorder Level</th></tr>
    <?php foreach ($rows as $r): ?><tr><td><?= htmlspecialchars($r['item_name']) ?></td><td><?= $r['quantity_on_hand'] ?></td><td><?= $r['reorder_level'] ?></td></tr><?php endforeach; ?>
    <?php if (!$rows): ?><tr><td colspan="3">No items below reorder level.</td></tr><?php endif; ?>
    </table>
    </div>
</div>
<?php endif; ?>

<?php if (in_array('payroll',$allowed)): ?>
<div class="card">
    <h3>Payroll Summary (This Month)</h3>
    <?php $r = $pdo->query("SELECT COUNT(*) n, COALESCE(SUM(net_pay),0) total FROM payroll WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())")->fetch(); ?>
    <p><?= $r['n'] ?> payroll record(s) — total net pay: ₱<?= number_format($r['total'],2) ?></p>
</div>
<?php endif; ?>

<?php if (in_array('financial',$allowed)): ?>
<div class="card">
    <h3>Financial Summary (This Month)</h3>
    <?php
    $inc = $pdo->query("SELECT COALESCE(SUM(amount),0) s FROM financial_transactions WHERE txn_type='income' AND MONTH(transaction_date)=MONTH(CURDATE())")->fetch()['s'];
    $exp = $pdo->query("SELECT COALESCE(SUM(amount),0) s FROM financial_transactions WHERE txn_type='expense' AND MONTH(transaction_date)=MONTH(CURDATE())")->fetch()['s'];
    ?>
    <p>Income: ₱<?= number_format($inc,2) ?> &nbsp;|&nbsp; Expenses: ₱<?= number_format($exp,2) ?> &nbsp;|&nbsp; Net: ₱<?= number_format($inc-$exp,2) ?></p>
</div>
<?php endif; ?>

<?php require __DIR__ . '/../../../includes/footer.php'; ?>
