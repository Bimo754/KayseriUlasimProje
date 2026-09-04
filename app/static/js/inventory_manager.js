/**
   Kayseri Ulaşım - İstasyon, Kiosk & Cihaz Envanter Yöneticisi (InventoryManager Facade)
 */

export {
    toggleAdminSidebar,
    renderList,
    selectStation,
    selectBayi,
    loadNearestPoints
} from './inventory/station_manager.js';

export {
    setInventoryChangedListener,
    selectKiosk,
    openKioskManagerModal,
    renderKioskTable,
    openAddKioskModal,
    handleAddKioskSubmit,
    openEditKioskModal,
    handleEditKioskSubmit,
    confirmDeleteKiosk,
    openSwapKioskModal,
    handleSwapKioskSubmit
} from './inventory/kiosk_manager.js';

export {
    openAddDeviceModal,
    handleAddDeviceSubmit,
    openEditDeviceModal,
    handleEditDeviceSubmit,
    confirmDeleteDevice,
    openRelocateDeviceModal,
    handleRelocateDeviceSubmit
} from './inventory/device_manager.js';
