<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('appointments');
$pdo = getDB();
$user = currentUser();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add') {
    $visitType = $_POST['visit_type'];
    $queueNo = null;
    if ($visitType === 'walk-in') {
        $queueNo = (int)$pdo->query("SELECT COALESCE(MAX(queue_number),0)+1 n FROM appointments WHERE scheduled_date = CURDATE()")->fetch()['n'];
    }
    $stmt = $pdo->prepare("INSERT INTO appointments (patient_id,visit_type,queue_number,scheduled_date,scheduled_time,assigned_staff_id,created_by) VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([$_POST['patient_id'],$visitType,$queueNo,$_POST['scheduled_date'],$_POST['scheduled_time'] ?: null,$_POST['assigned_staff_id'] ?: null,$user['id']]);
    logAction('CREATE','appointments',$pdo->lastInsertId(),"Added $visitType for patient #{$_POST['patient_id']}");
    $msg = 'Entry added to queue.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'status') {
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT) ?: 0;
    $status = $_POST['status'] ?? '';
    $validStatuses = ['in-consultation', 'completed', 'no-show'];
    if ($id < 1 || !in_array($status, $validStatuses, true)) { http_response_code(400); exit('Invalid appointment update.'); }
    $pdo->prepare("UPDATE appointments SET status=? WHERE id=?")->execute([$status, $id]);
    logAction('UPDATE','appointments',$id,"Status changed to $status");
    header('Location: /modules/appointments/index.php');
    exit;
}

$patients = $pdo->query("SELECT id, CONCAT(last_name,', ',first_name) name FROM patients WHERE archived_at IS NULL ORDER BY last_name")->fetchAll();
$staffList = $pdo->query("SELECT id, CONCAT(first_name,' ',last_name) name FROM staff WHERE status='active'")->fetchAll();
$queue = $pdo->query("SELECT a.*, CONCAT(p.last_name,', ',p.first_name) patient_name, CONCAT(s.first_name,' ',s.last_name) staff_name
                       FROM appointments a JOIN patients p ON a.patient_id=p.id LEFT JOIN staff s ON a.assigned_staff_id=s.id
                       WHERE a.scheduled_date = CURDATE() ORDER BY a.visit_type, a.queue_number, a.scheduled_time")->fetchAll();
$pageTitle = 'Appointments / Walk-in';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Appointments &amp; Walk-in Queue — Today</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>Add to Queue</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add">
        <div class="grid">
            <div><label>Patient</label>
                <select name="patient_id" required>
                    <?php foreach ($patients as $p): ?><option value="<?= $p['id'] ?>"><?= htmlspecialchars($p['name']) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div><label>Type</label>
                <select name="visit_type"><option value="walk-in">Walk-in</option><option value="appointment">Scheduled Appointment</option></select>
            </div>
            <div><label>Date</label><input type="date" name="scheduled_date" value="<?= date('Y-m-d') ?>" required></div>
            <div><label>Time (if scheduled)</label><input type="time" name="scheduled_time"></div>
            <div><label>Assign Staff</label>
                <select name="assigned_staff_id"><option value="">-- Unassigned --</option>
                    <?php foreach ($staffList as $s): ?><option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?></option><?php endforeach; ?>
                </select>
            </div>
        </div>
        <button type="submit">Add to Queue</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>#</th><th>Type</th><th>Patient</th><th>Time</th><th>Assigned Staff</th><th>Status</th><th>Actions</th></tr>
<?php foreach ($queue as $q): ?>
<tr>
    <td><?= $q['visit_type'] === 'walk-in' ? '#'.$q['queue_number'] : '-' ?></td>
    <td><?= htmlspecialchars($q['visit_type']) ?></td>
    <td><?= htmlspecialchars($q['patient_name']) ?></td>
    <td><?= htmlspecialchars($q['scheduled_time'] ?? '') ?></td>
    <td><?= htmlspecialchars($q['staff_name'] ?? 'Unassigned') ?></td>
    <td><?= htmlspecialchars($q['status']) ?></td>
    <td>
        <?php if ($q['status'] !== 'completed'): ?>
        <?php foreach (['in-consultation'=>'In Consult','completed'=>'Complete','no-show'=>'No-show'] as $nextStatus=>$label): ?>
        <form method="post" style="display:inline">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="status">
            <input type="hidden" name="id" value="<?= (int)$q['id'] ?>">
            <input type="hidden" name="status" value="<?= htmlspecialchars($nextStatus, ENT_QUOTES, 'UTF-8') ?>">
            <button type="submit" class="btn"><?= htmlspecialchars($label) ?></button>
        </form>
        <?php endforeach; ?>
        <?php endif; ?>
    </td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
