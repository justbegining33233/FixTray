const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Files with problematic logger calls
const filesToFix = [
  'src/app/api/admin/audit-logs/route.ts',
  'src/app/api/admin/backup/route.ts',
  'src/app/api/admin/command-center/route.ts',
  'src/app/api/admin/login/route.ts',
  'src/app/api/auth/admin/route.ts',
  'src/app/api/auth/customer/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/refresh/route.ts',
  'src/app/api/auth/reset/route.ts',
  'src/app/api/auth/reset/confirm/route.ts',
  'src/app/api/auth/shop/route.ts',
  'src/app/api/auth/tech-2fa/route.ts',
  'src/app/api/auth/tech/route.ts',
  'src/app/api/auth/verify-email/route.ts',
  'src/app/api/campaigns/route.ts',
  'src/app/api/contact/route.ts',
  'src/app/api/cron/keepalive/route.ts',
  'src/app/api/cron/recurring-workorders/route.ts',
  'src/app/api/customers/estimates/request-new/route.ts',
  'src/app/api/customers/login/route.ts',
  'src/app/api/dvi/[id]/send-to-customer/route.ts',
  'src/app/api/enterprise/route.ts',
  'src/app/api/fleet-accounts/[id]/invoices/route.ts',
  'src/app/api/fleet-accounts/[id]/route.ts',
  'src/app/api/fleet-accounts/[id]/vehicles/route.ts',
  'src/app/api/fleet-accounts/route.ts',
  'src/app/api/fleet-vehicles/[id]/route.ts',
  'src/app/api/leave-requests/[id]/route.ts',
  'src/app/api/leave-requests/route.ts',
  'src/app/api/loaner-vehicles/[id]/route.ts',
  'src/app/api/loaner-vehicles/route.ts',
  'src/app/api/payment/create-intent/route.ts',
  'src/app/api/payment/refund/route.ts',
  'src/app/api/push/send-to-customer/route.ts',
  'src/app/api/shift-swaps/[id]/route.ts',
  'src/app/api/shift-swaps/route.ts',
  'src/app/api/shifts/[id]/route.ts',
  'src/app/api/shifts/route.ts',
  'src/app/api/shops/[id]/reward-redemptions/route.ts',
  'src/app/api/state-inspections/route.ts',
  'src/app/api/workorders/[id]/route.ts',
  'src/app/api/workorders/[id]/time-tracking/route.ts',
  'src/app/api/workorders/route.ts',
  'src/lib/campaignService.ts',
  'src/lib/chaos.ts',
  'src/lib/compliance.ts',
  'src/lib/enterprise.ts',
  'src/lib/environmentalFeeService.ts',
  'src/lib/errorHandler.ts',
  'src/lib/fleetService.ts',
  'src/lib/inspectionService.ts',
  'src/lib/leaveService.ts',
  'src/lib/loanerService.ts',
  'src/lib/multiRegion.ts',
  'src/lib/serviceMesh.ts',
  'src/lib/shiftService.ts',
];

let fixed = 0;

for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⊘ File not found: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Pattern 1: logger.error('msg', error) -> logger.error('msg', { error: error instanceof Error ? error.message : String(error) })
  content = content.replace(
    /logger\.error\(([^,]+),\s*(error|err|e)\s*\)/g,
    (match, msg, errVar) => {
      return `logger.error(${msg}, { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}) })`;
    }
  );

  // Pattern 2: logger.error('msg', error, { meta }) -> logger.error('msg', { error: error instanceof Error ? error.message : String(error), ...meta })
  content = content.replace(
    /logger\.error\(([^,]+),\s*(error|err|e)\s*,\s*({[^}]+})\s*\)/g,
    (match, msg, errVar, meta) => {
      const metaContent = meta.slice(1, -1).trim(); // Remove braces
      return `logger.error(${msg}, { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}), ${metaContent} })`;
    }
  );

  // Pattern 3: logger.warn/info/debug with similar patterns
  content = content.replace(
    /logger\.(warn|info|debug)\(([^,]+),\s*(error|err|e)\s*\)/g,
    (match, method, msg, errVar) => {
      return `logger.${method}(${msg}, { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}) })`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    fixed++;
    console.log(`✓ Fixed: ${file}`);
  }
}

console.log(`\n✓ Fixed ${fixed}/${filesToFix.length} files`);
