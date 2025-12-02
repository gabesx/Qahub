// App configuration and metadata
export const appConfig = {
  name: 'QaHub',
  fullName: 'QaHub - Quality Management System',
  description: 'Test Management System with Document Management and Analytics',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  currentYear: new Date().getFullYear(),
  copyright: {
    company: 'QaHub',
    product: 'QMS',
    termsUrl: '/terms',
  },
} as const;

export const getCopyrightText = () => {
  return `Copyright © ${appConfig.currentYear} ${appConfig.copyright.company}- ${appConfig.copyright.product} - Supported by ${appConfig.copyright.company} Version ${appConfig.version} | Term & Condition`;
};

