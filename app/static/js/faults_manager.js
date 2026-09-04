/**
   Kayseri Ulaşım - Arıza Takip, Çözüm Geçmişi & Öncelik Yöneticisi (FaultsManager Facade)
 */

export {
    toggleAdminFaultsDrawer,
    switchAdminFaultsTab,
    fetchFaultsData,
    renderAdminFaultsDrawerList,
    renderAdminFaultsDrawerList as renderFaultsDrawerList,
    renderAdminActiveFaultsList,
    renderAdminRouteFaultsList,
    renderAdminResolvedFaultsList,
    findAssociatedStationOrKioskId,
    renderFaultLayers,
    selectFault
} from './faults/fault_list.js';

export {
    setFaultsChangedListener,
    selectFaultTypeChoice,
    resolveSpecificFault,
    toggleFaultResponsibility,
    deleteFaultAction,
    reopenFaultAction,
    handleQuickFaultInputSubmit,
    handleAddFaultSubmit
} from './faults/fault_actions.js';
