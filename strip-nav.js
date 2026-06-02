
const fs = require("fs");
const path = require("path");

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith("page.tsx")) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const targetDirs = ["src/app/shop", "src/app/manager", "src/app/tech", "src/app/customer"];
let pages = [];
for (const d of targetDirs) {
  if (fs.existsSync(d)) {
    pages = pages.concat(walkSync(d));
  }
}

let modified = 0;
// Exclude home pages and dashboard pages
const excludes = ["home/page.tsx", "dashboard/page.tsx", "admin/page.tsx"];

pages.forEach(file => {
  if (excludes.some(e => file.replace(/\\/g, "/").includes(e))) return;

  let content = fs.readFileSync(file, "utf8");
  let original = content;

  // Attempt to strip TopNav, Breadcrumbs, Sidebar imports
  content = content.replace(/import TopNavBar.*?\n/g, "");
  content = content.replace(/import Sidebar.*?\n/g, "");
  content = content.replace(/import Breadcrumbs.*?\n/g, "");
  content = content.replace(/const \[sidebarOpen, setSidebarOpen\] = useState.+?\n/g, "");

  // Now replace the structural layout.
  // Many pages look exactly like:
  /*
  return (
    <div style={{minHeight:'100vh', background: 'transparent', display:'flex', flexDirection:'column'}}>
      {/* Top Navigation *\/}
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
      
      {/* Breadcrumbs *\/}
      <Breadcrumbs />
      
      {/* Main Layout with Sidebar *\/}
      <div style={{display:'flex', flex:1}}>
        {/* Sidebar *\/}
        <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
  */
  
  // A regex targeting this specific chunk
  let pattern = /\{\/\*\s*Top Navigation\s*\*\/\}.*?\{\/\*\s*Main Layout with Sidebar\s*\*\/\}.*?\{\/\*\s*Sidebar\s*\*\/\}.*?<Sidebar.*?\/>(\s*\{\/\*\s*Main Content\s*\*\/\})?/s;
  
  if (pattern.test(content)) {
    content = content.replace(pattern, "");
    
    // Replace the opening of the layout
    // Replace `return (\n <div style...` down to the `{/* Main Content */}`
    console.log("Stripped structural topnav/sidebar in " + file);
  } else {
    // If it has TopNav but pattern failed
    if (content.includes("TopNavBar")) {
        console.log("File has TopNavBar but regex missed: " + file);
        // Force simple removal
        content = content.replace(/<TopNavBar.*?\/>/g, "");
        content = content.replace(/<Breadcrumbs.*?\/>/g, "");
        content = content.replace(/<Sidebar.*?\/>/g, "");
        content = content.replace(/\{\/\*\s*(Top Navigation|Breadcrumbs|Main Layout with Sidebar|Sidebar)\s*\*\/\}/g, "");
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    modified++;
  }
});
console.log("Total modified: " + modified);

