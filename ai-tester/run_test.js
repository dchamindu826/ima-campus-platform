import { Stagehand } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ ERROR: OPENAI_API_KEY is not set in the .env file.");
  console.error("Please add your OpenAI API Key to .env to run the AI Agent.");
  process.exit(1);
}

const roleArg = process.argv[2];
if (!roleArg) {
  console.error("❌ ERROR: Please provide a role to test.");
  console.error("Usage: node run_test.js manager");
  console.error("Usage: node run_test.js coordinator");
  process.exit(1);
}

const role = roleArg.toLowerCase();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Generate Markdown Report
async function generateReport(role, results) {
  const reportPath = path.resolve(`./${role}_test_report.md`);
  let content = `# 🤖 AI Agent Test Report: ${role.toUpperCase()}\n\n`;
  content += `**Date:** ${new Date().toLocaleString()}\n`;
  content += `**Frontend URL:** ${FRONTEND_URL}\n\n`;
  
  let passed = 0;
  let failed = 0;

  for (const res of results) {
    if (res.status === 'PASS') passed++;
    else failed++;
    
    content += `### ${res.task}\n`;
    content += `- **Status:** ${res.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`;
    content += `- **Agent Output:** ${res.details}\n\n`;
  }
  
  content += `## Summary\n`;
  content += `- **Total Checks:** ${results.length}\n`;
  content += `- **Passed:** ${passed}\n`;
  content += `- **Failed:** ${failed}\n\n`;
  content += `---\n*Report generated automatically by IMA-Campus AI Tester*`;
  
  fs.writeFileSync(reportPath, content);
  console.log(`\n📄 Report generated at: ${reportPath}`);
}

async function runTest() {
  console.log(`🚀 Starting AI Browser Agent for Role: ${role.toUpperCase()}`);
  console.log(`🔗 Target URL: ${FRONTEND_URL}`);

  // Initialize Stagehand (Playwright + AI)
  const stagehand = new Stagehand({ 
    env: "LOCAL",         // Run the browser locally on this machine
    modelName: "gpt-4o",  // Use OpenAI's GPT-4o for visual reasoning
    logger: () => {}      // Suppress noisy logs
  });
  
  await stagehand.init();
  const page = stagehand.page;
  const results = [];

  try {
    console.log("📍 Navigating to Login Page...");
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    
    // ============================================
    // MANAGER WORKFLOW
    // ============================================
    if (role === 'manager') {
      const email = process.env.MANAGER_EMAIL;
      const password = process.env.MANAGER_PASSWORD;

      if (!email || !password) {
          throw new Error("MANAGER_EMAIL and MANAGER_PASSWORD must be set in .env");
      }

      console.log("🔑 Logging in as Manager...");
      await page.act(`Type '${email}' into the email field and '${password}' into the password field`);
      await page.act("Click the Login or Sign In button");
      
      const loggedIn = await page.extract("Did the user successfully log in and reach a dashboard? Answer 'yes' or 'no'.");
      results.push({
        task: "Login as Manager",
        status: loggedIn.toLowerCase().includes('yes') ? "PASS" : "FAIL",
        details: `Login Check Result: ${loggedIn}`
      });
      
      if (loggedIn.toLowerCase().includes('yes')) {
         console.log("📂 Navigating to Call Center / Manager Dashboard...");
         await page.act("Click on the 'Call Center' or 'Manager Dashboard' or similar item in the sidebar navigation");
         
         const dashboardLoaded = await page.extract("Can you see statistics, charts, or a summary dashboard visible on the screen? Answer 'yes' or 'no'.");
         results.push({
            task: "Access Manager Dashboard",
            status: dashboardLoaded.toLowerCase().includes('yes') ? "PASS" : "FAIL",
            details: `Dashboard Check Result: ${dashboardLoaded}`
         });

         console.log("⚙️ Checking Settings/Team visibility...");
         await page.act("Click on Team, Staff, or User Management in the sidebar");
         const teamLoaded = await page.extract("Are there lists of staff members or team settings visible? Answer 'yes' or 'no'.");
         results.push({
            task: "Access Team Management",
            status: teamLoaded.toLowerCase().includes('yes') ? "PASS" : "FAIL",
            details: `Team Settings Check: ${teamLoaded}`
         });
      }

    // ============================================
    // COORDINATOR WORKFLOW
    // ============================================
    } else if (role === 'coordinator') {
      const email = process.env.COORDINATOR_EMAIL;
      const password = process.env.COORDINATOR_PASSWORD;

      if (!email || !password) {
          throw new Error("COORDINATOR_EMAIL and COORDINATOR_PASSWORD must be set in .env");
      }

      console.log("🔑 Logging in as Coordinator...");
      await page.act(`Type '${email}' into the email field and '${password}' into the password field`);
      await page.act("Click the Login or Sign In button");
      
      const loggedIn = await page.extract("Did the user successfully log in and reach the coordinator dashboard? Answer 'yes' or 'no'.");
      results.push({
        task: "Login as Coordinator",
        status: loggedIn.toLowerCase().includes('yes') ? "PASS" : "FAIL",
        details: `Login Check Result: ${loggedIn}`
      });
      
      if (loggedIn.toLowerCase().includes('yes')) {
         console.log("📋 Checking Tasks/Leads Assignment...");
         await page.act("Click on 'My Roster' or 'My Tasks' or 'Leads' in the sidebar navigation");
         
         const tasksLoaded = await page.extract("Are there any assigned leads or a list of tasks visible on the page? Answer 'yes' or 'no'.");
         results.push({
            task: "Access Assigned Leads/Tasks",
            status: tasksLoaded.toLowerCase().includes('yes') ? "PASS" : "FAIL",
            details: `Task Check Result: ${tasksLoaded}`
         });

         console.log("✏️ Checking task updating functionality...");
         // Example of clicking the first available task to open a modal
         await page.act("Click on the first lead or task in the list to view its details");
         const detailsLoaded = await page.extract("Did a modal or details page open containing information about the lead? Answer 'yes' or 'no'.");
         results.push({
            task: "View Lead Details",
            status: detailsLoaded.toLowerCase().includes('yes') ? "PASS" : "FAIL",
            details: `Details Check Result: ${detailsLoaded}`
         });
      }
    } else {
      throw new Error(`Unknown role: ${role}`);
    }
    
  } catch (err) {
    console.error("❌ Test failed unexpectedly:", err);
    results.push({
        task: "Execution Error",
        status: "FAIL",
        details: err.message
    });
  } finally {
    console.log("🛑 Closing Browser...");
    await stagehand.close();
    await generateReport(role, results);
  }
}

runTest();
