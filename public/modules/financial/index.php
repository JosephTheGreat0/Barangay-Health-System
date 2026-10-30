<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('financial');
$pdo = getDB();
$user = currentUser();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add') {
    $stmt = $pdo->prepare("INSERT INTO financial_transactions (txn_type,category,amount,description,transaction_date,recorded_by) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$_POST['txn_type'],$_POST['category'],$_POST['amount'],$_POST['description'],$_POST['transaction_date'],$user['id']]);
    logAction('CREATE','financial',$pdo->lastInsertId(),"Recorded {$_POST['txn_type']} of {$_POST['amount']} ({$_POST['category']})");
    $msg = 'Transaction recorded.';
}

$balance = $pdo->query("SELECT COALESCE(SUM(CASE WHEN txn_type='income' THEN amount ELSE -amount END),0) b FROM financial_transactions")->fetch()['b'];
$income = $pdo->query("SELECT COALESCE(SUM(amount),0) s FROM financial_transactions WHERE txn_type='income'")->fetch()['s'];
$expense = $pdo->query("SELECT COALESCE(SUM(amount),0) s FROM financial_transactions WHERE txn_type='expense'")->fetch()['s'];
$txns = $pdo->query("SELECT ft.*, u.full_name recorded_by_name FROM financial_transactions ft LEFT JOIN users u ON ft.recorded_by = u.id ORDER BY ft.transaction_date DESC, ft.id DESC LIMIT 50")->fetchAll();
$pageTitle = 'Financial Management';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Financial Management</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="grid">
    <div class="stat"><h3>₱<?= number_format($income,2) ?></h3><p>Total Income</p></div>
    <div class="stat"><h3>₱<?= number_format($expense,2) ?></h3><p>Total Expenses</p></div>
    <div class="stat"><h3>₱<?= number_format($balance,2) ?></h3><p>Current Fund Balance</p></div>
</div>

<div class="card">
    <h3>Record Transaction</h3>
    <p style="color:#666;font-size:0.85rem">Note: payroll and inventory purchase expenses are posted automatically from those modules when approved — you only need to log direct income (e.g. LGU funding, donations) or manual expenses here.</p>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add">
        <div class="grid">
            <div><label>Type</label><select name="txn_type"><option value="income">Income</option><option value="expense">Expense</option></select></div>
            <div><label>Category</label><input name="category" placeholder="LGU Funding, Donation, Utilities, etc." required></div>
            <div><label>Amount (₱)</label><input type="number" step="0.01" name="amount" required></div>
            <div><label>Date</label><input type="date" name="transaction_date" value="<?= date('Y-m-d') ?>" required></div>
            <div style="grid-column:1/-1"><label>Description</label><input name="description"></div>
        </div>
        <button type="submit">Record</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th><th>Source</th><th>Recorded By</th></tr>
<?php foreach ($txns as $t): ?>
<tr>
    <td><?= htmlspecialchars($t['transaction_date']) ?></td>
    <td><?= htmlspecialchars($t['txn_type']) ?></td>
    <td><?= htmlspecialchars($t['category']) ?></td>
    <td>₱<?= number_format($t['amount'],2) ?></td>
    <td><?= htmlspecialchars($t['description']) ?></td>
    <td><?= htmlspecialchars($t['reference_module'] ?: 'manual') ?></td>
    <td><?= htmlspecialchars($t['recorded_by_name'] ?? '') ?></td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
