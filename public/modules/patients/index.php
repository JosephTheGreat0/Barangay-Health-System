<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('patients');
$pdo = getDB();
$user = currentUser();
$msg = '';

// CREATE
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add') {
    $firstName = trim((string)($_POST['first_name'] ?? ''));
    $lastName = trim((string)($_POST['last_name'] ?? ''));
    $birthdate = trim((string)($_POST['birthdate'] ?? ''));
    $sex = (string)($_POST['sex'] ?? '');
    $address = trim((string)($_POST['address'] ?? ''));
    $contact = trim((string)($_POST['contact_number'] ?? ''));
    $philhealth = trim((string)($_POST['philhealth_no'] ?? ''));
    $guardian = trim((string)($_POST['guardian_name'] ?? ''));
    $validBirthdate = $birthdate === '' || (DateTime::createFromFormat('!Y-m-d', $birthdate) !== false && DateTime::createFromFormat('!Y-m-d', $birthdate)->format('Y-m-d') === $birthdate);
    if ($firstName === '' || $lastName === '' || strlen($firstName) > 100 || strlen($lastName) > 100 ||
        !in_array($sex, ['male','female'], true) || !$validBirthdate ||
        strlen($address) > 255 || strlen($contact) > 30 || strlen($philhealth) > 30 || strlen($guardian) > 150) {
        http_response_code(422);
        exit('Please check the patient information and try again.');
    }
    $stmt = $pdo->prepare("INSERT INTO patients (first_name,last_name,birthdate,sex,address,contact_number,philhealth_no,guardian_name,created_by) VALUES (?,?,?,?,?,?,?,?,?)");
    $stmt->execute([$firstName,$lastName,$birthdate ?: null,$sex,$address,$contact,$philhealth,$guardian,$user['id']]);
    $newId = $pdo->lastInsertId();
    logAction('CREATE','patients',$newId,'Registered patient record.');
    $msg = 'Patient registered.';
}

// DELETE
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT) ?: 0;
    if ($id < 1) { http_response_code(400); exit('Invalid patient ID.'); }
    $pdo->prepare("UPDATE patients SET archived_at=NOW() WHERE id=? AND archived_at IS NULL")->execute([$id]);
    logAction('ARCHIVE','patients',$id,'Archived patient record.');
    header('Location: /modules/patients/index.php');
    exit;
}

$patients = $pdo->query("SELECT id, first_name, last_name, sex, birthdate, created_at FROM patients WHERE archived_at IS NULL ORDER BY created_at DESC")->fetchAll();
$pageTitle = 'Patients';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Patient Records</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>Register New Patient</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add">
        <div class="grid">
            <div><label>First Name</label><input name="first_name" required></div>
            <div><label>Last Name</label><input name="last_name" required></div>
            <div><label>Birthdate</label><input type="date" name="birthdate"></div>
            <div><label>Sex</label>
                <select name="sex"><option value="male">Male</option><option value="female">Female</option></select>
            </div>
            <div><label>Contact Number</label><input name="contact_number"></div>
            <div><label>PhilHealth No.</label><input name="philhealth_no"></div>
            <div><label>Guardian Name</label><input name="guardian_name"></div>
            <div><label>Address</label><input name="address"></div>
        </div>
        <button type="submit">Register Patient</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>ID</th><th>Name</th><th>Sex</th><th>Birthdate</th><th>Actions</th></tr>
<?php foreach ($patients as $p): ?>
<tr>
    <td>#<?= $p['id'] ?></td>
    <td><?= htmlspecialchars($p['last_name'].', '.$p['first_name']) ?></td>
    <td><?= htmlspecialchars($p['sex']) ?></td>
    <td><?= htmlspecialchars($p['birthdate']) ?></td>
    <td>
        <form method="post" data-confirm="Archive this patient record?">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
            <button type="submit" class="btn btn-danger">Archive</button>
        </form>
    </td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
