<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('staff');
$pdo = getDB();
$user = currentUser();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add_staff') {
    $stmt = $pdo->prepare("INSERT INTO staff (first_name,last_name,position,contact_number,address,hire_date,daily_rate) VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([$_POST['first_name'],$_POST['last_name'],$_POST['position'],$_POST['contact_number'],$_POST['address'],$_POST['hire_date'] ?: null,$_POST['daily_rate'] ?: 0]);
    logAction('CREATE','staff',$pdo->lastInsertId(),"Added staff {$_POST['first_name']} {$_POST['last_name']}");
    $msg = 'Staff member added.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add_schedule') {
    $stmt = $pdo->prepare("INSERT INTO staff_schedule (staff_id,work_date,shift_start,shift_end,notes,created_by) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$_POST['staff_id'],$_POST['work_date'],$_POST['shift_start'],$_POST['shift_end'],$_POST['notes'],$user['id']]);
    logAction('CREATE','staff_schedule',$pdo->lastInsertId(),"Scheduled staff #{$_POST['staff_id']} on {$_POST['work_date']}");
    $msg = 'Schedule entry added.';
}

$staffList = $pdo->query("SELECT * FROM staff ORDER BY last_name")->fetchAll();
$schedule = $pdo->query("SELECT sc.*, CONCAT(s.first_name,' ',s.last_name) staff_name FROM staff_schedule sc JOIN staff s ON sc.staff_id=s.id WHERE sc.work_date >= CURDATE() ORDER BY sc.work_date, sc.shift_start LIMIT 30")->fetchAll();
$pageTitle = 'Staff & Schedule';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Staff Management</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>Add Staff Member</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add_staff">
        <div class="grid">
            <div><label>First Name</label><input name="first_name" required></div>
            <div><label>Last Name</label><input name="last_name" required></div>
            <div><label>Position</label><input name="position" placeholder="e.g. Midwife, BHW, Doctor"></div>
            <div><label>Contact</label><input name="contact_number"></div>
            <div><label>Hire Date</label><input type="date" name="hire_date"></div>
            <div><label>Daily Rate (₱)</label><input type="number" step="0.01" name="daily_rate"></div>
            <div><label>Address</label><input name="address"></div>
        </div>
        <button type="submit">Add Staff</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>ID</th><th>Name</th><th>Position</th><th>Contact</th><th>Daily Rate</th><th>Status</th></tr>
<?php foreach ($staffList as $s): ?>
<tr>
    <td>#<?= $s['id'] ?></td>
    <td><?= htmlspecialchars($s['last_name'].', '.$s['first_name']) ?></td>
    <td><?= htmlspecialchars($s['position']) ?></td>
    <td><?= htmlspecialchars($s['contact_number']) ?></td>
    <td>₱<?= number_format($s['daily_rate'],2) ?></td>
    <td><?= htmlspecialchars($s['status']) ?></td>
</tr>
<?php endforeach; ?>
</table>
</div>

<div class="card">
    <h3>Assign Duty Schedule</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add_schedule">
        <div class="grid">
            <div><label>Staff</label>
                <select name="staff_id" required>
                    <?php foreach ($staffList as $s): ?><option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['first_name'].' '.$s['last_name']) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div><label>Date</label><input type="date" name="work_date" required></div>
            <div><label>Shift Start</label><input type="time" name="shift_start" required></div>
            <div><label>Shift End</label><input type="time" name="shift_end" required></div>
            <div><label>Notes</label><input name="notes"></div>
        </div>
        <button type="submit">Assign Schedule</button>
    </form>
</div>

<h3>Upcoming Schedule</h3>
<div class="table-wrap">
<table>
<tr><th>Date</th><th>Staff</th><th>Shift</th><th>Notes</th></tr>
<?php foreach ($schedule as $sc): ?>
<tr>
    <td><?= htmlspecialchars($sc['work_date']) ?></td>
    <td><?= htmlspecialchars($sc['staff_name']) ?></td>
    <td><?= htmlspecialchars($sc['shift_start'].' - '.$sc['shift_end']) ?></td>
    <td><?= htmlspecialchars($sc['notes']) ?></td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
