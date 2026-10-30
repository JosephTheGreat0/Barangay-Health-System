<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/audit.php';
requireModule('inventory');
$pdo = getDB();
$user = currentUser();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add_item') {
    $stmt = $pdo->prepare("INSERT INTO inventory_items (item_name,category,unit,quantity_on_hand,reorder_level,expiry_date,unit_cost) VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([$_POST['item_name'],$_POST['category'],$_POST['unit'],$_POST['quantity_on_hand'] ?: 0,$_POST['reorder_level'] ?: 10,$_POST['expiry_date'] ?: null,$_POST['unit_cost'] ?: 0]);
    logAction('CREATE','inventory',$pdo->lastInsertId(),"Added inventory item {$_POST['item_name']}");
    $msg = 'Item added.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'txn') {
    $itemId = (int)$_POST['item_id'];
    $qty = (int)$_POST['quantity'];
    $type = $_POST['txn_type'];
    $delta = $type === 'stock-in' ? $qty : -$qty;

    $recordCost = filter_var($_POST['record_cost'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($itemId < 1 || $qty < 1 || !in_array($type, ['stock-in','stock-out'], true) || $recordCost === false || $recordCost < 0) {
        http_response_code(400); exit('Invalid inventory transaction.');
    }
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare("SELECT quantity_on_hand FROM inventory_items WHERE id=? FOR UPDATE");
        $lock->execute([$itemId]);
        $current = $lock->fetchColumn();
        if ($current === false || ($type === 'stock-out' && (int)$current < $qty)) {
            throw new RuntimeException('Insufficient stock or item not found.');
        }
        $pdo->prepare("UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ? WHERE id=?")->execute([$delta, $itemId]);
        $pdo->prepare("INSERT INTO inventory_transactions (item_id,txn_type,quantity,reference_note,performed_by) VALUES (?,?,?,?,?)")
            ->execute([$itemId,$type,$qty,substr(trim($_POST['reference_note'] ?? ''),0,255),$user['id']]);

        if ($type === 'stock-in' && $recordCost > 0) {
            $pdo->prepare("INSERT INTO financial_transactions (txn_type,category,amount,description,reference_module,reference_id,transaction_date,recorded_by) VALUES ('expense','Supply Purchase',?,?,'inventory',?,CURDATE(),?)")
                ->execute([$recordCost, "Stock-in: " . substr(trim($_POST['reference_note'] ?? ''),0,180), $itemId, $user['id']]);
        }
        logAction('UPDATE','inventory',$itemId,"$type of $qty units");
        $pdo->commit();
        $msg = 'Stock transaction recorded.';
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(409);
        exit('Inventory transaction could not be completed. Check available stock and try again.');
    }
}

$items = $pdo->query("SELECT * FROM inventory_items ORDER BY item_name")->fetchAll();
$pageTitle = 'Inventory';
require __DIR__ . '/../../../includes/header.php';
?>
<h2>Inventory Management</h2>
<?php if ($msg): ?><div class="success"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

<div class="card">
    <h3>Add New Item</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="add_item">
        <div class="grid">
            <div><label>Item Name</label><input name="item_name" required></div>
            <div><label>Category</label><input name="category" placeholder="Medicine / Supply"></div>
            <div><label>Unit</label><input name="unit" placeholder="box, bottle, pc"></div>
            <div><label>Starting Qty</label><input type="number" name="quantity_on_hand" value="0"></div>
            <div><label>Reorder Level</label><input type="number" name="reorder_level" value="10"></div>
            <div><label>Expiry Date</label><input type="date" name="expiry_date"></div>
            <div><label>Unit Cost (₱)</label><input type="number" step="0.01" name="unit_cost" value="0"></div>
        </div>
        <button type="submit">Add Item</button>
    </form>
</div>

<div class="card">
    <h3>Record Stock In / Out</h3>
    <form method="post">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="txn">
        <div class="grid">
            <div><label>Item</label>
                <select name="item_id" required>
                    <?php foreach ($items as $i): ?><option value="<?= $i['id'] ?>"><?= htmlspecialchars($i['item_name']) ?> (on hand: <?= $i['quantity_on_hand'] ?>)</option><?php endforeach; ?>
                </select>
            </div>
            <div><label>Type</label><select name="txn_type"><option value="stock-in">Stock In</option><option value="stock-out">Stock Out</option></select></div>
            <div><label>Quantity</label><input type="number" name="quantity" required min="1"></div>
            <div><label>Reference/Note</label><input name="reference_note" placeholder="e.g. Dispensed to patient / PO#123"></div>
            <div><label>Cost if Purchase (₱, optional)</label><input type="number" step="0.01" name="record_cost" value="0"></div>
        </div>
        <button type="submit">Record Transaction</button>
    </form>
</div>

<div class="table-wrap">
<table>
<tr><th>Item</th><th>Category</th><th>On Hand</th><th>Reorder Level</th><th>Expiry</th><th>Unit Cost</th><th>Status</th></tr>
<?php foreach ($items as $i): $low = $i['quantity_on_hand'] <= $i['reorder_level']; ?>
<tr>
    <td><?= htmlspecialchars($i['item_name']) ?></td>
    <td><?= htmlspecialchars($i['category']) ?></td>
    <td><?= $i['quantity_on_hand'] ?> <?= htmlspecialchars($i['unit']) ?></td>
    <td><?= $i['reorder_level'] ?></td>
    <td><?= htmlspecialchars($i['expiry_date']) ?></td>
    <td>₱<?= number_format($i['unit_cost'],2) ?></td>
    <td><span class="badge <?= $low ? 'badge-low' : 'badge-ok' ?>"><?= $low ? 'LOW STOCK' : 'OK' ?></span></td>
</tr>
<?php endforeach; ?>
</table>
</div>
<?php require __DIR__ . '/../../../includes/footer.php'; ?>
