import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { FeaturePermissions, UserRole, logActivity } from '../services/adminService';

export interface FeatureAccessContextType {
  featurePermissions: FeaturePermissions;
  isMaster: boolean;
  isManager: boolean;
  userRole: UserRole;
  can: (key: keyof FeaturePermissions) => boolean;
  canExport: (format?: string) => boolean;
  guardAction: (key: keyof FeaturePermissions, actionName: string, action: () => void) => boolean;
}

const FeatureAccessContext = createContext<FeatureAccessContextType | null>(null);

export interface FeatureAccessProviderProps {
  featurePermissions: FeaturePermissions;
  isMaster: boolean;
  isManager: boolean;
  userRole: UserRole;
  showToast?: (message: string) => void;
  children: React.ReactNode;
}

export const FeatureAccessProvider: React.FC<FeatureAccessProviderProps> = ({
  featurePermissions,
  isMaster,
  isManager,
  userRole,
  showToast,
  children
}) => {
  const can = useCallback((key: keyof FeaturePermissions): boolean => {
    if (isMaster) return true;
    return featurePermissions?.[key] !== false;
  }, [isMaster, featurePermissions]);

  const canExport = useCallback((format?: string): boolean => {
    if (isMaster) return true;
    if (featurePermissions?.allowExportData === false) return false;
    if (!format) return true;

    const fmt = format.toLowerCase().trim();
    if (fmt === 'csv') return featurePermissions?.allowExportCsv !== false;
    if (fmt === 'kml') return featurePermissions?.allowExportKml !== false;
    if (fmt === 'kmz') return featurePermissions?.allowExportKmz !== false;
    if (fmt === 'geojson') return featurePermissions?.allowExportGeoJson !== false;
    if (fmt === 'shapefile' || fmt === 'shp') return featurePermissions?.allowExportShapefile !== false;
    if (fmt === 'gpkg' || fmt === 'geopackage') return featurePermissions?.allowExportGeoPackage !== false;

    return true;
  }, [isMaster, featurePermissions]);

  const guardAction = useCallback((key: keyof FeaturePermissions, actionName: string, action: () => void): boolean => {
    if (can(key)) {
      action();
      return true;
    }

    logActivity('ACESSO', `Ação bloqueada por restrição de permissão: "${actionName}"`, userRole);
    if (showToast) {
      showToast(`⚠️ Acesso restrito: Você não possui permissão para ${actionName}.`);
    }
    return false;
  }, [can, userRole, showToast]);

  const value = useMemo<FeatureAccessContextType>(() => ({
    featurePermissions,
    isMaster,
    isManager,
    userRole,
    can,
    canExport,
    guardAction
  }), [featurePermissions, isMaster, isManager, userRole, can, canExport, guardAction]);

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
    </FeatureAccessContext.Provider>
  );
};

export const useFeatureAccess = (): FeatureAccessContextType => {
  const ctx = useContext(FeatureAccessContext);
  if (!ctx) {
    return {
      featurePermissions: {} as FeaturePermissions,
      isMaster: true,
      isManager: false,
      userRole: 'master',
      can: () => true,
      canExport: () => true,
      guardAction: (_k, _name, action) => { action(); return true; }
    };
  }
  return ctx;
};
