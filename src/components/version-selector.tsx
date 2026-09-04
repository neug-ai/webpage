"use client";

import { usePathname } from "next/navigation";
import versionsData from "../../versions.json";
import { getAssetPrefix } from "../../asset-prefix.mjs";

interface VersionSelectorProps {
  currentVersion: string;
  currentLang: string;
}

export const VersionSelector = ({ currentVersion, currentLang }: VersionSelectorProps) => {
  const pathname = usePathname();
  const { versions, current } = versionsData;
  const basePath = getAssetPrefix();
  
  // Find the current version info
  const latestVersion = versions.find(v => v.isLatest)?.version || current;
  const displayVersion = currentVersion === "latest" ? latestVersion : currentVersion;
  const currentVersionInfo = versions.find(v => v.version === displayVersion);
  
  // Get current path without version and language prefix
  const getPagePath = () => {
    let path = pathname;
    // Remove basePath if present
    if (basePath && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    // Remove leading slash
    path = path.replace(/^\//, '');
    // Split and remove version and lang segments
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2) {
      // Remove version and lang (first two segments)
      return segments.slice(2).join('/');
    }
    return '';
  };

  const handleVersionChange = (newVersion: string) => {
    const pagePath = getPagePath();
    const targetPath = pagePath 
      ? `${basePath}/${newVersion}/${currentLang}/${pagePath}`
      : `${basePath}/${newVersion}/${currentLang}/overview/introduction/`;
    window.location.href = targetPath;
  };

  // If only one version, show badge
  if (versions.length <= 1) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
        {currentVersionInfo?.label || displayVersion}
      </span>
    );
  }

  // Multiple versions - show dropdown
  return (
    <select 
      className="text-xs font-mono px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      value={displayVersion}
      onChange={(e) => handleVersionChange(e.target.value)}
    >
      {versions.map((v) => (
        <option key={v.version} value={v.version}>
          {v.label}
        </option>
      ))}
    </select>
  );
};

export default VersionSelector;
