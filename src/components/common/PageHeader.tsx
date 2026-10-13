import React from 'react';

export interface PageHeaderProps {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconClassName?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  iconClassName = 'text-terracotta',
  eyebrow,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className={`w-5 h-5 stroke-[2.2] ${iconClassName}`} />;
  };

  return (
    <header className={`flex items-start justify-between gap-3 select-none ${className}`}>
      {/* Left: Icon Badge & Titles */}
      <div className="flex items-start space-x-3 min-w-0 flex-1">
        {icon && (
          <div className="w-10 h-10 rounded-2xl bg-obsidian-surface border border-obsidian-border flex items-center justify-center flex-shrink-0 shadow-specular mt-0.5">
            {renderIcon()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[10px] font-bold text-bone-400 uppercase tracking-wider mb-0.5 leading-snug">
              {eyebrow}
            </div>
          )}
          <h1 className="text-base sm:text-lg font-semibold text-bone-100 tracking-tight truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-bone-400 mt-0.5 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions / Telemetry Slot */}
      {actions && (
        <div className="flex items-center space-x-2 flex-shrink-0 pt-0.5">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
