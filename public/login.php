<?php
require_once __DIR__ . '/../includes/auth.php';
if (currentUser()) { header('Location: /index.php'); exit; }

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrfRequest();
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if (login($username, $password)) {
        header('Location: /index.php');
        exit;
    }
    $error = 'Invalid username or password.';
}
$pageTitle = 'Login';
require __DIR__ . '/../includes/header.php';
?>
<div class="login-wrap">
    <h1>BHIMS<br><small>Barangay Health Information &amp; Management System</small></h1>
    <?php if ($error): ?><div class="error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <form method="post">
        <?= csrfField() ?>
        <label>Username</label>
        <input type="text" name="username" required autofocus>
        <label>Password</label>
        <input type="password" name="password" required>
        <button type="submit" style="width:100%">Log In</button>
    </form>
</div>
<?php require __DIR__ . '/../includes/footer.php'; ?>
