/**
   Kayseri Ulaşım - Arıza Çözme, Sorumluluk Değiştirme, NLP Ayrıştırma & Ekleme (FaultActions)
 */

import { state } from '../state.js';
import { ApiService } from '../api.js';
import { showToast, closeModal } from '../ui_utils.js';
import { fetchFaultsData } from './fault_list.js';

let onFaultChangedGlobal = null;

export function setFaultsChangedListener(fn) {
    onFaultChangedGlobal = fn;
}

export function getFaultsChangedListener() {
    return onFaultChangedGlobal;
}

export function selectFaultTypeChoice(cardElem, typeValue, defaultText) {
    const parent = document.getElementById('fault-type-selector');
    if (parent) {
        parent.querySelectorAll('.fault-choice-card').forEach(c => c.classList.remove('active'));
    }
    if (cardElem) cardElem.classList.add('active');

    const typeInput = document.getElementById('add-fault-type');
    const textInput = document.getElementById('add-fault-text');
    if (typeInput) typeInput.value = typeValue;
    if (textInput) textInput.value = defaultText;
}

export async function resolveSpecificFault(faultId) {
    const fault = state.faultsData.find(f => f.id === faultId);
    if (!fault) return;

    try {
        const res = await ApiService.updateFaultStatus(faultId, 'COZULDU', {
            enlem: fault.enlem,
            boylam: fault.boylam,
            lokasyon_adi: fault.lokasyon_adi
        });

        if (res.basarili) {
            showToast(`${fault.lokasyon_adi} arızası çözüldü olarak işaretlendi!`, 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Arıza durumu güncellenirken hata oluştu.', 'error');
    }
}

export async function toggleFaultResponsibility(faultId) {
    try {
        const res = await ApiService.toggleFaultResponsibility(faultId);
        if (res.basarili) {
            showToast(res.mesaj, 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Sorumluluk güncellenirken hata oluştu.', 'error');
    }
}

export async function deleteFaultAction(faultId) {
    if (state.currentUser && state.currentUser.rol !== 'ADMIN') {
        showToast('Bu işlemi gerçekleştirme yetkiniz yok. Sadece yöneticiler arıza kaydı silebilir.', 'error');
        return;
    }
    if (!confirm('Bu arıza kaydını silmek istediğinize emin misiniz?')) return;

    try {
        const res = await ApiService.deleteFault(faultId);
        if (res.basarili) {
            showToast(res.mesaj, 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Arıza silinirken hata oluştu.', 'error');
    }
}

export async function reopenFaultAction(faultId) {
    try {
        const res = await ApiService.updateFaultStatus(faultId, 'BEKLIYOR');
        if (res.basarili) {
            showToast('Arıza yeniden aktif arızalar listesine alındı.', 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Arıza durumu güncellenirken hata oluştu.', 'error');
    }
}

export async function handleQuickFaultInputSubmit(e) {
    if (e) e.preventDefault();
    const inputAdmin = document.getElementById('input-quick-fault-admin');
    if (!inputAdmin) return;

    const text = inputAdmin.value.trim();
    if (!text) {
        showToast('Lütfen ayrıştırılacak arıza metnini giriniz.', 'info');
        return;
    }

    try {
        const res = await ApiService.parseBulkFaultText(text);
        if (res.basarili) {
            inputAdmin.value = '';
            showToast(res.mesaj, 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Metin ayrıştırılırken hata oluştu.', 'error');
    }
}

export async function handleAddFaultSubmit(e) {
    if (e) e.preventDefault();
    const loc = document.getElementById('add-fault-location').value.trim();
    const type = document.getElementById('add-fault-type').value;
    const text = document.getElementById('add-fault-text').value.trim();
    const resp = document.getElementById('add-fault-resp').value;

    if (!loc || !text) {
        showToast('Lütfen lokasyon ve arıza açıklamasını giriniz.', 'info');
        return;
    }

    try {
        const res = await ApiService.addFault({
            lokasyon_adi: loc,
            ariza_tipi: type,
            ariza_metni: text,
            sorumluluk: resp
        });

        if (res.basarili) {
            closeModal('modal-add-fault');
            document.getElementById('form-manual-fault').reset();
            showToast(res.mesaj, 'success');
            await fetchFaultsData();
            if (onFaultChangedGlobal) {
                await onFaultChangedGlobal();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Arıza kaydedilirken hata oluştu.', 'error');
    }
}
