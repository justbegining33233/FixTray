#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Scan all page.tsx files and analyze implementation status
function scanPages(dir, prefix = '') {
  const results = {};
  
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        const subResults = scanPages(fullPath, prefix + file.name + '/');
        Object.assign(results, subResults);
      } else if (file.name === 'page.tsx') {
        const content = fs.readFileSync(fullPath, 'utf8');
        const size = fs.statSync(fullPath).size;
        
        // Determine implementation status
        const hasUseEffect = content.includes('useEffect');
        const hasFetch = content.includes('fetch(');
        const hasAPI = content.includes('/api/');
        const hasState = content.includes('useState');
        const hasComplexUI = size > 2000;
        
        let status = 'STUB';
        if (hasUseEffect && (hasFetch || hasAPI) && hasComplexUI) {
          status = 'GO';
        } else if (hasFetch || (hasUseEffect && hasState)) {
          status = 'GO';
        } else if (size < 500) {
          status = 'NO-GO';
        } else if (hasComplexUI) {
          status = 'GO';
        }
        
        const pagePath = prefix.replace(/\/$/, '');
        results[pagePath] = {
          status,
          size,
          hasData: hasUseEffect || hasFetch || hasAPI,
          features: {
            useEffect: hasUseEffect,
            fetch: hasFetch,
            API: hasAPI,
            state: hasState
          }
        };
      }
    }
  } catch (err) {
    // Skip errors
  }
  
  return results;
}

// Main execution
const appDir = path.join(__dirname, 'src/app');
const pages = scanPages(appDir);

// Group by role
const roles = {
  admin: {},
  shop: {},
  manager: {},
  tech: {},
  customer: {},
  superadmin: {}
};

for (const [pagePath, data] of Object.entries(pages)) {
  for (const role of Object.keys(roles)) {
    if (pagePath.startsWith(role + '/') || pagePath === role) {
      const cleanPath = pagePath.substring(role.length + 1) || 'home';
      roles[role][cleanPath] = data;
    }
  }
}

// Output GO/NO-GO report
console.log('\n' + '='.repeat(80));
console.log('FIXTRAY GO/NO-GO IMPLEMENTATION CHECKLIST');
console.log('='.repeat(80) + '\n');

for (const [role, pages] of Object.entries(roles)) {
  if (Object.keys(pages).length === 0) continue;
  
  console.log(`\n┌─ ${role.toUpperCase()} ROLE`);
  console.log('├' + '─'.repeat(78));
  
  let goCount = 0;
  let noGoCount = 0;
  
  for (const [page, data] of Object.entries(pages).sort()) {
    const status = data.status === 'GO' ? '✅ GO' : '❌ NO-GO';
    if (data.status === 'GO') goCount++;
    else noGoCount++;
    
    const features = [];
    if (data.features.useEffect) features.push('useEffect');
    if (data.features.fetch) features.push('fetch');
    if (data.features.API) features.push('API');
    if (data.features.state) features.push('state');
    
    const featureStr = features.length > 0 ? ` [${features.join(', ')}]` : '';
    console.log(`│ ${status}  ${(page || 'home').padEnd(40)} ${featureStr.padEnd(25)} (${data.size} bytes)`);
  }
  
  console.log('├' + '─'.repeat(78));
  console.log(`│ Summary: ${goCount} GO | ${noGoCount} NO-GO`);
  console.log('└' + '─'.repeat(78));
}

// Summary stats
const allPages = Object.values(roles).reduce((acc, r) => ({ ...acc, ...r }), {});
const totalGo = Object.values(allPages).filter(p => p.status === 'GO').length;
const totalNoGo = Object.values(allPages).filter(p => p.status === 'NO-GO').length;

console.log(`\n${'='.repeat(80)}`);
console.log(`TOTAL: ${totalGo} GO | ${totalNoGo} NO-GO | ${Math.round(totalGo / (totalGo + totalNoGo) * 100)}% COMPLETE`);
console.log(`${'='.repeat(80)}\n`);
