<?php
require_once __DIR__ . '/auth.php';
$user = currentUser();
$permissions = require __DIR__ . '/../config/permissions.php';
$allowedModules = $user ? ($user['role'] === 'admin' ? ['patients','appointments','staff','payroll','financial','inventory','referral','reports','audit'] : ($permissions[$user['role']] ?? [])) : [];

$navLabels = [
    'patients' => 'Patients', 'appointments' => 'Appointments / Walk-in', 'staff' => 'Staff & Schedule',
    'payroll' => 'Payroll', 'financial' => 'Financial', 'inventory' => 'Inventory',
    'referral' => 'Referrals', 'reports' => 'Reports', 'audit' => 'Audit Trail',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($pageTitle ?? APP_NAME) ?></title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<?php if ($user): ?>
<header class="topbar">
    <div class="topbar-left">
        <button type="button" class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
        <div class="brand">BHIMS <span>Barangay Health System</span></div>
    </div>
    <div class="userbox">
        <?= htmlspecialchars($user['full_name']) ?> (<?= htmlspecialchars($user['role']) ?>)
        &nbsp;|&nbsp;
        <form method="post" action="/logout.php" style="display:inline">
            <?= csrfField() ?>
            <button type="submit">Logout</button>
        </form>
    </div>
</header>
<div class="nav-overlay" id="navOverlay"></div>
<nav class="sidenav" id="sideNav">
    <a href="/index.php">Dashboard</a>
    <?php foreach ($allowedModules as $mod): ?>
        <a href="/modules/<?= $mod ?>/index.php"><?= $navLabels[$mod] ?></a>
    <?php endforeach; ?>
</nav>
<main class="content">
<?php endif; ?>
