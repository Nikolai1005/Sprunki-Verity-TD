(() => {
  'use strict';

  const arenaKey = 'vault_party_v10';
  const arenaKeys = [arenaKey, 'vault_party_v9', 'vault_party_v8', 'vault_party_v7'];
  const allowed = window.TicketLimitedUnits;
  const idValid = id => typeof id === 'string' && /^[a-z0-9-]{12,64}$/i.test(id);

  function readArena() {
    for (const key of arenaKeys) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid arena save');
      const tickets = Number(data.t ?? 0);
      if (!Number.isFinite(tickets) || tickets < 0 || tickets > Number.MAX_SAFE_INTEGER) throw Error('Invalid ticket balance');
      return {data, tickets, original: key === arenaKey ? raw : null};
    }
    return {data:{}, tickets:0, original:null};
  }

  function wallet(profile) {
    const receipts = profile.vaultShop?.receipts || {};
    try {
      return {balance:Math.floor(readArena().tickets), receipts};
    } catch {
      return {balance:null, receipts};
    }
  }

  function grant(profile, key, price) {
    if (profile.vaultShop.receipts?.[key] > 0) return false;
    profile.own[key] ||= 1;
    profile.vaultShop = {...profile.vaultShop, receipts:{...profile.vaultShop.receipts, [key]:price}};
    return true;
  }

  function mergePurchases(profile, stored) {
    const prior = stored?.vaultShop;
    if (!idValid(prior?.id) || (profile.vaultShop?.id && profile.vaultShop.id !== prior.id)) return;
    profile.vaultShop ??= {id:prior.id, receipts:{}};
    for (const key of Object.keys(allowed)) {
      const receipt = prior.receipts?.[key];
      if (!Number.isSafeInteger(receipt) || receipt <= 0 || profile.vaultShop.receipts?.[key] > 0) continue;
      profile.vaultShop = {...profile.vaultShop, receipts:{...profile.vaultShop.receipts, [key]:receipt}};
      if (stored.own?.[key]) profile.own[key] ||= stored.own[key];
    }
  }

  function recover(profile) {
    const id = profile.vaultShop?.id;
    if (!idValid(id)) return false;
    let orders;
    try {
      orders = readArena().data.tdPurchases?.[id];
    } catch {
      return false;
    }
    let changed = false;
    for (const key of Object.keys(allowed)) {
      const receipt = orders?.[key];
      if (Number.isSafeInteger(receipt) && receipt > 0 && grant(profile, key, receipt)) changed = true;
    }
    return changed;
  }

  function buy(key) {
    if (!Object.hasOwn(allowed,key) || Date.now() >= VAULT_SALE_END) return 'closed';
    if (accountReloading || window.VerityTester?.isSimulating()) return 'error';
    const stored = JSON.parse(localStorage.getItem('vtd') || 'null');
    if (stored && stored.accountRevision !== M.accountRevision) return 'error';
    mergePurchases(M, stored);
    if (M.own[key] || M.vaultShop?.receipts?.[key] > 0 || apMarketWallet().receipts[key] > 0) return 'owned';

    const {data, tickets, original} = readArena();
    const price = allowed[key].unlockTickets;
    const existingId = M.vaultShop?.id;
    const existingReceipt = idValid(existingId) ? data.tdPurchases?.[existingId]?.[key] : null;
    const alreadyPaid = Number.isSafeInteger(existingReceipt) && existingReceipt > 0;
    if (!alreadyPaid && tickets < price) return 'insufficient';
    if (!idValid(existingId)) {
      const previous = M.vaultShop;
      const id = crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      M.vaultShop = {id, receipts:{}};
      if (!save()) {
        if (previous === undefined) delete M.vaultShop;
        else M.vaultShop = previous;
        return 'error';
      }
    }

    const shop = M.vaultShop, id = shop.id;
    const paid = alreadyPaid ? null : JSON.stringify({...data, t:tickets-price,
      tdPurchases:{...data.tdPurchases, [id]:{...data.tdPurchases?.[id], [key]:price}}});
    if (paid !== null) localStorage.setItem(arenaKey, paid);
    grant(M, key, alreadyPaid ? existingReceipt : price);
    if (save()) return 'bought';

    M.vaultShop = shop;
    delete M.own[key];
    if (paid !== null && localStorage.getItem(arenaKey) === paid) {
      if (original === null) localStorage.removeItem(arenaKey);
      else localStorage.setItem(arenaKey, original);
    }
    return 'error';
  }

  async function purchase(key) {
    try {
      if (navigator.locks) return await navigator.locks.request('verity-vault-ticket-shop', () => buy(key));
      return buy(key);
    } catch {
      return 'error';
    }
  }

  function refreshShop() {
    if (cur === 'shp' && SH.tab === 'vault') shRender();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (recover(M)) save();
  });
  addEventListener('storage', event => {
    if (event.key === arenaKey) {
      refreshShop();
    } else if (event.key === 'vtd' && event.newValue) {
      try {
        const stored = JSON.parse(event.newValue);
        if (stored?.accountRevision !== M.accountRevision) return;
        mergePurchases(M, stored);
        refreshShop();
      } catch {}
    }
  });

  window.VaultTicketShop = {wallet, purchase, mergePurchases};
})();
