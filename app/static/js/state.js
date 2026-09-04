/**
 * Kayseri Ulaşım - Reaktif Uygulama Durumu (State Management)
 */

export const state = {
    // Veri Modelleri
    appData: null,
    faultsData: [],
    resolvedFaultsData: [],
    activeNavigationRoute: null,
    currentTargetStop: null,
    currentUser: null,

    // Görünüm Modu: 'saha' (Saha Operatör Konsolu) veya 'admin' (Yönetici Komuta Portalı)
    activeRoleView: 'saha',

    // Rol bazlı bağımsız harita katman filtre durumları
    roleLayerStates: {
        admin: {
            route: true,
            faults: true,
            lines: true,
            stations: true,
            stationNames: true,
            kiosks: true,
            kioskNames: false,
            bayiler: false
        },
        saha: {
            route: true,
            faults: true,
            lines: false,
            stations: false,
            stationNames: true,
            kiosks: false,
            kioskNames: false,
            bayiler: false
        }
    },

    // Yönetici Arıza Paneli Sekmesi: 'route' veya 'resolved'
    adminFaultTab: 'route',

    // Filtre ve Arama Durumları
    currentFilter: 'all', // 'all', 'T1', 'T2', 'T3', 'T4', 'KIOSK', 'BAYI', 'ARIZA'
    currentSearchTerm: '',
    currentFaultRespFilter: 'ALL', // 'ALL', 'DAHILI', 'TASERON'
    currentFaultFilter: 'ALL', // 'ALL', 'ACIL', 'KIOSK', 'TURNIKE', 'IADE'
    currentFaultSearchTerm: '',
    currentResolvedFaultSearchTerm: '',
    currentRouteSearchTerm: '',

    // Aktif Seçili Öğe
    activeItemId: null,
    activeItemType: null, // 'ISTASYON', 'KIOSK', 'BAYI', 'ARIZA'

    // Bağlantılı Araç Durumları (Saha ve Admin Ayrımı)
    adminActiveVehicleImei: '861000000000001',
    sahaActiveVehicleImei: null,
    activeVehicleImei: '861000000000001',
    activeDispatchMode: 'DUAL_SPLIT',

    // Koordinat Seçici Durumu
    coordPickingTarget: null, // 'add', 'edit' veya null
    tempPickMarker: null
};

export const layerGroups = {
    route: null,
    faults: null,
    lines: null,
    stations: null,
    kiosks: null,
    bayiler: null,
    base: null,
    vehicle: null
};

export const markersMap = {};
