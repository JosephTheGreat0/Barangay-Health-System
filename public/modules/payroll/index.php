<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('payroll');
$pdo = getDB();
$user = currentUser();
$msg = '';

// Generate payroll for a staff member over a period, based on attendance days present * daily_rate
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'generate') {
    $staffId = (int)$_POST['staff_id'];
    $start = $_POST['period_start'];
    $end = $_POST['period_end'];
    $deductions = (float)($_POST['deductions'] ?: 0);

    $staff = $pdo->prepare("SELECT * FROM staff WHERE id=?");
    $staff->execute([$staffId]);
    $staff = $staff->fetch();

    $daysWorked = $pdo->prepare("SELECT COUNT(*) c FROM attendance WHERE staff_id=? AND attendance_date BETWEEN ? AND ? AND status='present'");
    $daysWorked->execute([$staffId, $start, $end]);
    $daysWorked = (int)$daysWorked->fetch()['c'];

    $basicPay = $daysWorked * $staff['daily_rate'];
    $netPay = $basicPay - $deductions;

    $stmt = $pdo->prepare("INSERT INTO payroll (staff_id,period_start,period_end,days_worked,basic_pay,deductions,net_pay,status,generated_by) VALUES (?,?,?,?,?,?,?,'draft',?)");
    $stmt->execute([$staffId,$start,$end,$daysWorked,$basicPay,$deductions,$netPay,$user['id']]);
    logAction('CREATE','payroll',$pdo->lastInsertId(),"Generated draft payroll for staff #$staffId ($start to $end)");
    $msg = "Draft payroll generated: $daysWorked day(s), net pay ₱" . number_format($netPay,2);
}

// Approve payroll (admin/hr) -> also posts an expense to Financial module
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'approve') {
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT) ?: 0;
    if ($id < 1) { http_response_code(400); exit('Invalid payroll ID.'); }
    $pdo->beginTransaction();
    try {
        $prStmt = $pdo->prepare("SELECT * FROM payroll WHERE id=? FOR UPDATE");
        $prStmt->execute([$id]);
        $pr = $prStmt->fetch();
        if (!$pr || $pr['status'] !== 'draft') {
            throw new RuntimeException('Payroll is missing or has already been processed.');
        }
        $updated = $pdo->prepare("UPDATE payroll SET status='approved', approved_by=? WHERE id=? AND status='draft'");
        $updated->execute([$user['id'], $id]);
        if ($updated->rowCount() !== 1) {
            throw new RuntimeException('Payroll status changed; reload and try again.');
        }
        $existing = $pdo->prepare("SELECT id FROM financial_transactions WHERE reference_module='payroll' AND reference_id=? LIMIT 1");
        $existing->execute([$id]);
        if ($existing->fetch()) {
            throw new RuntimeException('A payroll ledger entry already exists.');
        }
        $pdo->prepare("INSERT INTO financial_transactions (txn_type,category,amount,description,reference_module,reference_id,transaction_date,recorded_by) VALUES ('expense','Payroll',?,?,'payroll',?,CURDATE(),?)")
            ->execute([$pr['net_pay'], "Payroll for staff #{$pr['staff_id']} ({$pr['period_start']} to {$pr['period_end']})", $id, $user['id']]);
        logAction('UPDATE','payroll',$id,"Approved payroll #$id and posted ledger entry.");
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(409);
        exit('Payroll could not be approved. Please reload and check its status.');
    }
    header('Location: /modules/payroll/index.php');
    exit;
}

$staffList = $pdo->query("SELECT * FROM staff WHERE status='active' ORDER BY last_name")->fetchAll();
$payrolls = $pdo->query("SELECT pr.*, CONCAT(s.first_name,' ',s.last_name) staff_name FROM payroll pr JOIN staff s ON pr.staff_id=s.id ORDER BY pr.created_at DESC LIMIT 30")->fetchAll();
$pageTitle = 'Payroll';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Payroll</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>Generate Payroll</h3>
    <p style="color:#666;font-size:0.85rem">Net pay is computed automatically from attendance (days present × daily rate) minus deductions, based on the staff's assigned schedule.</p>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="generate">
        <div class="grid">
            <div><label>Staff</label>
                <select name="staff_id" required>
                    <?php foreach ($staffList as $s): ?><option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['first_name'].' '.$s['last_name']) ?> (₱<?= number_format($s['daily_rate'],2) ?>/day)</option><?php endforeach; ?>
                </select>
            </div>
            <div><label>Period Start</label><input type="date" name="period_start" required></div>
            <div><label>Period End</label><input type="date" name="period_end" required></div>
            <div><label>Deductions (₱)</label><input type="number" step="0.01" name="deductions" value="0"></div>
        </div>
        <button type="submit">Generate Draft Payroll</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>ID</th><th>Staff</th><th>Period</th><th>Days</th><th>Basic Pay</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr>
<?php foreach ($payrolls as $p): ?>
<tr>
    <td>#<?= $p['id'] ?></td>
    <td><?= htmlspecialchars($p['staff_name']) ?></td>
    <td><?= htmlspecialchars($p['period_start'].' to '.$p['period_end']) ?></td>
    <td><?= $p['days_worked'] ?></td>
    <td>₱<?= number_format($p['basic_pay'],2) ?></td>
    <td>₱<?= number_format($p['deductions'],2) ?></td>
    <td>₱<?= number_format($p['net_pay'],2) ?></td>
    <td><?= htmlspecialchars($p['status']) ?></td>
    <td><?php if ($p['status']==='draft'): ?>
        <form method="post" data-confirm="Approve this payroll? This will post an expense to Financial records.">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="approve">
            <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
            <button type="submit" class="btn">Approve</button>
        </form>
    <?php endif; ?></td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
