"use client";

import { Badge } from "@/components/ui/badge";
import versionsData from "../../versions.json";

export const VersionBadge = () => {
  const currentVersion = versionsData.current;
  const versionInfo = versionsData.versions.find(v => v.version === currentVersion);
  
  return (
    <Badge 
      variant="outline" 
      className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
    >
      {versionInfo?.label || currentVersion}
    </Badge>
  );
};

export const VersionSelector = () => {
  const { versions, current } = versionsData;
  
  if (versions.length <= 1) {
    return <VersionBadge />;
  }
  
  // TODO: Implement dropdown for multiple versions
  return (
    <select 
      className="text-xs font-mono px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
      defaultValue={current}
      onChange={(e) => {
        const version = e.target.value;
        // TODO: Navigate to the same page in different version
        console.log("Switch to version:", version);
      }}
    >
      {versions.map((v) => (
        <option key={v.version} value={v.version}>
          {v.label}
        </option>
      ))}
    </select>
  );
};

export const getVersionInfo = () => versionsData;
