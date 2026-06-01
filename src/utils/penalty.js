async function applyDeathPenalty(user) {
    const lsIdx = user.inventory?.findIndex(i => i.item === 'lifesaver' && i.quantity > 0);
    if (lsIdx !== undefined && lsIdx >= 0) {
        user.inventory[lsIdx].quantity--;
        if (user.inventory[lsIdx].quantity <= 0) user.inventory.splice(lsIdx, 1);
        user.gamblingBoostExpires = Date.now() + 5 * 60 * 1000;
        await user.save();
        return { blocked: true };
    }

    if (user.balance > 0) {
        const penalty = parseFloat((user.balance * 0.02).toFixed(2));
        user.balance  = parseFloat((user.balance - penalty).toFixed(2));
        await user.save();
        return { blocked: false, penalty, from: 'wallet' };
    }

    const penalty = parseFloat((user.bank * 0.04).toFixed(2));
    user.bank     = parseFloat((user.bank - penalty).toFixed(2));
    await user.save();
    return { blocked: false, penalty, from: 'bank' };
}

module.exports = { applyDeathPenalty };
