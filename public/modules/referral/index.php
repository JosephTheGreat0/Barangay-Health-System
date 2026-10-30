<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('referral');
$pdo = getDB();
$user = currentUser();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add') {
    $staffId = $user['staff_id'] ?: $_POST['referring_staff_id'];
    $stmt = $pdo->prepare("INSERT INTO referrals (patient_id,referring_staff_id,receiving_facility,reason,referral_date) VALUES (?,?,?,?,?)");
    $stmt->execute([$_POST['patient_id'],$staffId,$_POST['receiving_facility'],$_POST['reason'],$_POST['referral_date']]);
    logAction('CREATE','referral',$pdo->lastInsertId(),"Referred patient #{$_POST['patient_id']} to {$_POST['receiving_facility']}");
    $msg = 'Referral created.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'status') {
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT) ?: 0;
    $status = $_POST['status'] ?? '';
    $validStatuses = ['accepted', 'declined', 'completed'];
    if ($id < 1 || !in_array($status, $validStatuses, true)) { http_response_code(400); exit('Invalid referral update.'); }
    $pdo->prepare("UPDATE referrals SET status=?, outcome_notes=? WHERE id=?")->execute([$status, $_POST['outcome_notes'] ?? '', $id]);
    logAction('UPDATE','referral',$id,"Status updated to $status");
    header('Location: /modules/referral/index.php');
    exit;
}

$patients = $pdo->query("SELECT id, CONCAT(last_name,', ',first_name) name FROM patients ORDER BY last_name")->fetchAll();
$staffList = $pdo->query("SELECT id, CONCAT(first_name,' ',last_name) name FROM staff WHERE status='active'")->fetchAll();
$referrals = $pdo->query("SELECT r.*, CONCAT(p.last_name,', ',p.first_name) patient_name, CONCAT(s.first_name,' ',s.last_name) staff_name
                           FROM referrals r JOIN patients p ON r.patient_id=p.id JOIN staff s ON r.referring_staff_id=s.id
                           ORDER BY r.created_at DESC")->fetchAll();
$pageTitle = 'Referrals';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Patient Referrals</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>New Referral</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add">
        <div class="grid">
            <div><label>Patient</label>
                <select name="patient_id" required><?php foreach ($patients as $p): ?><option value="<?= $p['id'] ?>"><?= htmlspecialchars($p['name']) ?></option><?php endforeach; ?></select>
            </div>
            <div><label>Referring Staff</label>
                <select name="referring_staff_id"><?php foreach ($staffList as $s): ?><option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?></option><?php endforeach; ?></select>
            </div>
            <div><label>Receiving Facility</label><input name="receiving_facility" placeholder="e.g. City General Hospital" required></div>
            <div><label>Referral Date</label><input type="date" name="referral_date" value="<?= date('Y-m-d') ?>" required></div>
            <div style="grid-column:1/-1"><label>Reason</label><textarea name="reason" rows="2"></textarea></div>
        </div>
        <button type="submit">Create Referral</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>ID</th><th>Patient</th><th>Referred By</th><th>Facility</th><th>Date</th><th>Status</th><th>Actions</th></tr>
<?php foreach ($referrals as $r): ?>
<tr>
    <td>#<?= $r['id'] ?></td>
    <td><?= htmlspecialchars($r['patient_name']) ?></td>
    <td><?= htmlspecialchars($r['staff_name']) ?></td>
    <td><?= htmlspecialchars($r['receiving_facility']) ?></td>
    <td><?= htmlspecialchars($r['referral_date']) ?></td>
    <td><?= htmlspecialchars($r['status']) ?></td>
    <td>
        <?php if ($r['status'] === 'pending'): ?>
        <?php foreach (['accepted'=>'Accepted','declined'=>'Declined'] as $nextStatus=>$label): ?>
        <form method="post" style="display:inline">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="status">
            <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
            <input type="hidden" name="status" value="<?= htmlspecialchars($nextStatus, ENT_QUOTES, 'UTF-8') ?>">
            <button type="submit" class="btn"><?= htmlspecialchars($label) ?></button>
        </form>
        <?php endforeach; ?>
        <?php elseif ($r['status'] === 'accepted'): ?>
        <form method="post" style="display:inline">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="status">
            <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
            <input type="hidden" name="status" value="completed">
            <button type="submit" class="btn">Mark Completed</button>
        </form>
        <?php endif; ?>
    </td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
