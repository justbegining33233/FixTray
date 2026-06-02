// Email service for notifications
// Configure with Resend or SendGrid API key in environment variables

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// Email templates
export const emailTemplates = {
  inventoryRequestCreated: (shopName: string, itemName: string, quantity: number, urgency: string) => ({
    subject: `[${urgency.toUpperCase()}] New Inventory Request - ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e5332a;">New Inventory Request</h2>
        <p>A new inventory request has been submitted for <strong>${shopName}</strong>:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Item:</strong> ${itemName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Urgency:</strong> <span style="color: ${urgency === 'urgent' ? '#ef4444' : urgency === 'high' ? '#f59e0b' : '#22c55e'};">${urgency}</span></p>
        </div>
        <p>Please review and approve or deny this request in the shop admin panel.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/shop/admin" style="display: inline-block; background: #e5332a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">View Request</a>
      </div>
    `,
  }),

  inventoryRequestApproved: (itemName: string, quantity: number) => ({
    subject: `Inventory Request Approved - ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">âœ… Request Approved</h2>
        <p>Your inventory request has been approved:</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
          <p><strong>Item:</strong> ${itemName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Status:</strong> <span style="color: #22c55e;">Approved</span></p>
        </div>
        <p>The item will be ordered and made available soon.</p>
      </div>
    `,
  }),

  inventoryRequestDenied: (itemName: string, quantity: number, reason?: string) => ({
    subject: `Inventory Request Denied - ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">âŒ Request Denied</h2>
        <p>Your inventory request has been denied:</p>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p><strong>Item:</strong> ${itemName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Status:</strong> <span style="color: #ef4444;">Denied</span></p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        <p>Please contact your shop admin for more information.</p>
      </div>
    `,
  }),
  lowStockAlert: (itemName: string, quantity: number, reorderPoint: number) => ({
    subject: `âš ï¸ Low Stock Alert - ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">âš ï¸ Low Stock Alert</h2>
        <p>Inventory levels are running low:</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Item:</strong> ${itemName}</p>
          <p><strong>Current Quantity:</strong> ${quantity}</p>
          <p><strong>Reorder Point:</strong> ${reorderPoint}</p>
        </div>
        <p>Please reorder this item to avoid stockouts.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/shop/inventory" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">View Inventory</a>
      </div>
    `,
  }),
  clockInReminder: (techName: string) => ({
    subject: 'Clock-In Reminder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">â° Time to Clock In</h2>
        <p>Hi ${techName},</p>
        <p>This is a friendly reminder to clock in for your shift.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/tech/home" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">Clock In Now</a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">Don't forget to clock out at the end of your shift!</p>
      </div>
    `,
  }),

  payrollBudgetAlert: (shopName: string, currentSpend: number, budget: number, percentage: number) => ({
    subject: `ðŸ’° Payroll Budget Alert - ${percentage}% Used`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${percentage >= 90 ? '#ef4444' : '#f59e0b'};">ðŸ’° Payroll Budget Alert</h2>
        <p><strong>${shopName}</strong> payroll spending update:</p>
        <div style="background: ${percentage >= 90 ? '#fef2f2' : '#fffbeb'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${percentage >= 90 ? '#ef4444' : '#f59e0b'};">
          <p><strong>Current Spend:</strong> $${currentSpend.toFixed(2)}</p>
          <p><strong>Budget:</strong> $${budget.toFixed(2)}</p>
          <p><strong>Percentage Used:</strong> <span style="color: ${percentage >= 90 ? '#ef4444' : '#f59e0b'};">${percentage}%</span></p>
        </div>
        ${percentage >= 90 ? '<p style="color: #ef4444; font-weight: bold;">âš ï¸ Warning: You have used over 90% of your payroll budget!</p>' : '<p>You are approaching your payroll budget limit.</p>'}
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/shop/admin" style="display: inline-block; background: #e5332a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">View Payroll</a>
      </div>
    `,
  }),

  estimateReady: (customerName: string, workOrderId: string, serviceAmount: number, totalDue: number, shopName: string, description: string) => ({
    subject: `Your Estimate Is Ready â€” ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 0; border-radius: 10px; overflow: hidden;">
        <div style="background: #e5332a; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900;">FixTray</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Vehicle Repair & Service</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #111827; margin: 0 0 8px;">ðŸ“‹ Your Estimate Is Ready</h2>
          <p style="color: #6b7280; margin: 0 0 24px;">Hi ${customerName}, ${shopName} has prepared an estimate for your vehicle service.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: #374151;"><strong>Service:</strong> ${description}</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>Service Cost:</strong> $${serviceAmount.toFixed(2)}</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>FixTray Fee:</strong> $5.00</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 700;"><strong>Total Due: $${totalDue.toFixed(2)}</strong></p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/customer/workorders/${workOrderId}" style="display: block; background: #22c55e; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center;">Review &amp; Pay Estimate</a>
          <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">This estimate was prepared by ${shopName} and requires your approval before work begins.</p>
        </div>
      </div>
    `,
  }),

  jobCompleted: (customerName: string, workOrderId: string, totalDue: number, shopName: string, description: string) => ({
    subject: `Your Vehicle Is Ready for Pickup â€” ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 0; border-radius: 10px; overflow: hidden;">
        <div style="background: #e5332a; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900;">FixTray</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Vehicle Repair & Service</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #111827; margin: 0 0 8px;">ðŸŽ‰ Job Complete â€” Your Vehicle Is Ready!</h2>
          <p style="color: #6b7280; margin: 0 0 24px;">Hi ${customerName}, great news! ${shopName} has finished work on your vehicle.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: #374151;"><strong>Work Completed:</strong> ${description}</p>
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 700;"><strong>Amount Due: $${totalDue.toFixed(2)}</strong></p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/customer/workorders/${workOrderId}" style="display: block; background: #22c55e; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center;">Pay Now &amp; Schedule Pickup</a>
          <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">Secured by Stripe â€¢ PCI DSS Compliant</p>
        </div>
      </div>
    `,
  }),

  paymentReceipt: (customerName: string, workOrderId: string, amountPaid: number, shopName: string, description: string) => ({
    subject: `Payment Receipt â€” ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 0; border-radius: 10px; overflow: hidden;">
        <div style="background: #e5332a; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900;">FixTray</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Payment Receipt</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #22c55e; margin: 0 0 8px;">âœ… Payment Successful</h2>
          <p style="color: #6b7280; margin: 0 0 24px;">Hi ${customerName}, your payment to ${shopName} was received successfully.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: #374151;"><strong>Service:</strong> ${description}</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>Shop:</strong> ${shopName}</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>Work Order:</strong> #${workOrderId.slice(-8).toUpperCase()}</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
            <p style="margin: 0; color: #22c55e; font-size: 20px; font-weight: 700;">Amount Paid: $${amountPaid.toFixed(2)}</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/customer/workorders/${workOrderId}" style="display: block; background: #3b82f6; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center;">View Work Order</a>
          <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">Keep this email as your receipt. Thank you for using FixTray!</p>
        </div>
      </div>
    `,
  }),

  shopApproved: (shopName: string, ownerEmail: string, username: string, tempPassword?: string | null) => ({
    subject: `ðŸŽ‰ Your Shop Has Been Approved â€” Welcome to FixTray!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 0; border-radius: 10px; overflow: hidden;">
        <div style="background: #e5332a; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900;">FixTray</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Shop Management Platform</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #22c55e; margin: 0 0 8px;">ðŸŽ‰ Congratulations! Your Shop Is Approved</h2>
          <p style="color: #6b7280; margin: 0 0 24px;"><strong>${shopName}</strong> has been approved on the FixTray platform. You can now log in and start managing work orders.</p>
          ${tempPassword ? `
          <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: #374151; font-weight: 700;">Your Login Credentials</p>
            <p style="margin: 0 0 8px; color: #374151;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 0; color: #374151;"><strong>Temporary Password:</strong> <code style="background: #fef9c3; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
            <p style="margin: 8px 0 0; color: #92400e; font-size: 12px;">âš ï¸ Please change your password after your first login.</p>
          </div>
          ` : `
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0; color: #374151;"><strong>Username:</strong> ${username}</p>
          </div>
          `}
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" style="display: block; background: #e5332a; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center;">Log In to Your Shop</a>
          <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">Welcome to FixTray â€” the easiest way to manage your auto shop.</p>
        </div>
      </div>
    `,
  }),
};

// Send email function (configure with your email service)
export async function sendEmail({ to, subject, html, from }: EmailOptions): Promise<boolean> {
  try {
    // For Resend
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        console.error('Resend API error:', await response.text());
        return false;
      }

      return true;
    }

    // No email service configured — warn and fail
    console.warn('[emailService] RESEND_API_KEY is not set — email NOT sent:', subject, 'to:', to);
    return false;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Helper to send notification emails
export async function sendInventoryRequestNotification(
  shopEmail: string,
  shopName: string,
  itemName: string,
  quantity: number,
  urgency: string
) {
  const template = emailTemplates.inventoryRequestCreated(shopName, itemName, quantity, urgency);
  return sendEmail({
    to: shopEmail,
    ...template,
  });
}

export async function sendInventoryApprovalNotification(
  techEmail: string,
  itemName: string,
  quantity: number,
  approved: boolean,
  reason?: string
) {
  const template = approved
    ? emailTemplates.inventoryRequestApproved(itemName, quantity)
    : emailTemplates.inventoryRequestDenied(itemName, quantity, reason);
  
  return sendEmail({
    to: techEmail,
    ...template,
  });
}

export async function sendLowStockAlert(
  shopEmail: string,
  itemName: string,
  quantity: number,
  reorderPoint: number
) {
  const template = emailTemplates.lowStockAlert(itemName, quantity, reorderPoint);
  
  return sendEmail({
    to: shopEmail,
    ...template,
  });
}

export async function sendEstimateReadyEmail(
  customerEmail: string,
  customerName: string,
  workOrderId: string,
  serviceAmount: number,
  totalDue: number,
  shopName: string,
  description: string
) {
  const template = emailTemplates.estimateReady(customerName, workOrderId, serviceAmount, totalDue, shopName, description);
  return sendEmail({ to: customerEmail, ...template });
}

export async function sendJobCompletedEmail(
  customerEmail: string,
  customerName: string,
  workOrderId: string,
  totalDue: number,
  shopName: string,
  description: string
) {
  const template = emailTemplates.jobCompleted(customerName, workOrderId, totalDue, shopName, description);
  return sendEmail({ to: customerEmail, ...template });
}

export async function sendPaymentReceiptEmail(
  customerEmail: string,
  customerName: string,
  workOrderId: string,
  amountPaid: number,
  shopName: string,
  description: string
) {
  const template = emailTemplates.paymentReceipt(customerName, workOrderId, amountPaid, shopName, description);
  return sendEmail({ to: customerEmail, ...template });
}

export async function sendShopApprovedEmail(
  shopEmail: string,
  shopName: string,
  username: string,
  tempPassword?: string | null
) {
  const template = emailTemplates.shopApproved(shopName, shopEmail, username, tempPassword);
  return sendEmail({ to: shopEmail, ...template });
}

export async function sendRecurringApprovalEmail(
  customerEmail: string,
  customerName: string,
  serviceName: string,
  shopName: string,
  estimatedCost?: number | null
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const reviewUrl = `${appUrl}/customer/recurring-approvals`;
  const subject = `Your ${serviceName} Is Due - Confirm or Skip`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #e5332a, #c0392b); padding: 32px; text-align: center;">
        <div style="font-size: 36px; font-weight: 900; color: white; letter-spacing: -1px;">FixTray</div>
        <div style="color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 6px;">Service Reminder</div>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #e5e7eb; margin: 0 0 12px;">Hi ${customerName},</h2>
        <p style="color: #9aa3b2; line-height: 1.6; margin-bottom: 24px;">
          <strong style="color: #e5e7eb;">${shopName}</strong> has your scheduled
          <strong style="color: #e5e7eb;">${serviceName}</strong> coming up.
          Let them know if you want to come in - <strong>no bay will be reserved until you confirm.</strong>
        </p>
        <div style="background: rgba(229,51,42,0.1); border: 1px solid rgba(229,51,42,0.3); border-radius: 12px; padding: 20px; margin-bottom: 28px;">
          <div style="font-size: 18px; font-weight: 700; color: #e5e7eb; margin-bottom: 8px;">[Service] ${serviceName}</div>
          <div style="color: #9aa3b2; font-size: 14px;">Shop: ${shopName}</div>
          ${estimatedCost ? `<div style="color: #9aa3b2; font-size: 14px; margin-top: 4px;">Estimated cost: <strong style="color: #22c55e;">$${estimatedCost.toFixed(2)}</strong></div>` : ''}
        </div>
        <table width="100%" style="margin-bottom: 28px;"><tr>
          <td style="padding-right: 8px;">
            <a href="${reviewUrl}" style="display: block; background: #22c55e; color: white; padding: 14px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">Yes, Schedule Me In</a>
          </td>
          <td style="padding-left: 8px;">
            <a href="${reviewUrl}" style="display: block; background: rgba(255,255,255,0.08); color: #9aa3b2; padding: 14px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; border: 1px solid rgba(255,255,255,0.15);">Skip This Time</a>
          </td>
        </tr></table>
        <p style="color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
          Manage all your pending service requests at<br/>
          <a href="${reviewUrl}" style="color: #e5332a;">${reviewUrl}</a>
        </p>
      </div>
    </div>
  `;
  return sendEmail({ to: customerEmail, subject, html });
}
// Recurring service reminders (14-day and 7-day advance notice)
export async function sendRecurringReminderEmail(
  customerEmail: string,
  customerName: string,
  serviceName: string,
  shopName: string,
  shopId: string,
  daysUntilDue: 14 | 7,
  estimatedCost?: number | null
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const scheduleUrl = `${appUrl}/book/${shopId}`;
  const urgency = daysUntilDue === 7 ? 'coming up in ONE WEEK' : 'coming up in 2 weeks';
  const marker = daysUntilDue === 7 ? '[Urgent]' : '[Reminder]';
  const subject = `${marker} Your ${serviceName} is due in ${daysUntilDue} days - ${shopName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #e5332a, #c0392b); padding: 32px; text-align: center;">
        <div style="font-size: 36px; font-weight: 900; color: white; letter-spacing: -1px;">FixTray</div>
        <div style="color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 6px;">Service Reminder - ${daysUntilDue} Days Notice</div>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #e5e7eb; margin: 0 0 12px;">Hey ${customerName}!</h2>
        <p style="color: #9aa3b2; line-height: 1.6; margin-bottom: 24px;">
          Your <strong style="color: #e5e7eb;">${serviceName}</strong> at 
          <strong style="color: #e5e7eb;">${shopName}</strong> is <strong style="color: ${daysUntilDue === 7 ? '#f59e0b' : '#e5e7eb'};">${urgency}.</strong>
          Would you like to schedule it?
        </p>
        <div style="background: rgba(229,51,42,0.1); border: 1px solid rgba(229,51,42,0.3); border-radius: 12px; padding: 20px; margin-bottom: 28px;">
          <div style="font-size: 20px; font-weight: 700; color: #e5e7eb; margin-bottom: 6px;">${marker} ${serviceName}</div>
          <div style="color: #9aa3b2; font-size: 14px; margin-bottom: 4px;">Shop: <strong style="color: #e5e7eb;">${shopName}</strong></div>
          ${estimatedCost ? `<div style="color: #9aa3b2; font-size: 14px;">Estimated cost: <strong style="color: #22c55e;">$${estimatedCost.toFixed(2)}</strong></div>` : ''}
        </div>
        <a href="${scheduleUrl}" style="display: block; background: #22c55e; color: white; padding: 16px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; margin-bottom: 16px;">
          Yes, Schedule Me In at ${shopName}
        </a>
        <p style="color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6; margin: 0;">
          If you don't want to schedule, simply ignore this email.<br/>
          Sent by ${shopName} via <a href="${appUrl}" style="color: #e5332a;">FixTray</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}
// ---------------------------------------------------------------------------
// Simple wrappers — replacements for the legacy nodemailer-based email.ts
// These route through Resend (RESEND_API_KEY must be set).
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<boolean> {
  return sendEmail({
    to: toEmail,
    subject: 'Welcome to FixTray!',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:10px;overflow:hidden;"><div style="background:#e5332a;padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:28px;font-weight:900;">FixTray</h1></div><div style="padding:32px;"><h2 style="color:#111827;">Welcome, ${name}!</h2><p style="color:#6b7280;">Thank you for registering with FixTray. You can now create work orders and track your vehicle service history.</p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/auth/login" style="display:inline-block;background:#e5332a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;">Log In</a></div></div>`,
  });
}

export async function sendWorkOrderCreatedEmail(toEmail: string, workOrderId: string): Promise<boolean> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/customer/workorders/${workOrderId}`;
  return sendEmail({
    to: toEmail,
    subject: 'Work Order Created — FixTray',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:10px;overflow:hidden;"><div style="background:#e5332a;padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:28px;font-weight:900;">FixTray</h1></div><div style="padding:32px;"><h2 style="color:#111827;">Work Order Received</h2><p style="color:#6b7280;">Your work order <strong>#${workOrderId.slice(-8).toUpperCase()}</strong> has been created. You'll be notified when the shop reviews it.</p><a href="${url}" style="display:inline-block;background:#e5332a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;">View Work Order</a></div></div>`,
  });
}

export async function sendStatusUpdateEmail(toEmail: string, workOrderId: string, status: string): Promise<boolean> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/customer/workorders/${workOrderId}`;
  const label = status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return sendEmail({
    to: toEmail,
    subject: `Work Order Status Updated — ${label}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:10px;overflow:hidden;"><div style="background:#e5332a;padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:28px;font-weight:900;">FixTray</h1></div><div style="padding:32px;"><h2 style="color:#111827;">Work Order Update</h2><p style="color:#6b7280;">Work order <strong>#${workOrderId.slice(-8).toUpperCase()}</strong> is now: <strong style="color:#e5332a;">${label}</strong></p><a href="${url}" style="display:inline-block;background:#e5332a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;">View Work Order</a></div></div>`,
  });
}

export async function sendPaymentConfirmationEmail(toEmail: string, workOrderId: string, amount: number): Promise<boolean> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/customer/workorders/${workOrderId}`;
  return sendEmail({
    to: toEmail,
    subject: `Payment Confirmation — $${amount.toFixed(2)}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:10px;overflow:hidden;"><div style="background:#e5332a;padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:28px;font-weight:900;">FixTray</h1></div><div style="padding:32px;"><h2 style="color:#22c55e;">Payment Confirmed</h2><p style="color:#6b7280;">Payment of <strong>$${amount.toFixed(2)}</strong> received for work order <strong>#${workOrderId.slice(-8).toUpperCase()}</strong>.</p><a href="${url}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;">View Invoice</a></div></div>`,
  });
}

/**
 * Notify a shop owner that their trial period is ending in ~3 days.
 */
export async function sendTrialEndingEmail(
  shopEmail: string,
  shopName: string,
  trialEndDate: Date
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const settingsUrl = `${appUrl}/shop/settings`;
  const formattedDate = trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return sendEmail({
    to: shopEmail,
    subject: `Your FixTray Trial Ends ${formattedDate} — Add a Payment Method`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#e5332a,#c0392b);padding:32px;text-align:center;">
          <div style="font-size:36px;font-weight:900;color:white;letter-spacing:-1px;">FixTray</div>
          <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:6px;">Trial Ending Soon</div>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#e5e7eb;margin:0 0 12px;">Hi ${shopName},</h2>
          <p style="color:#9aa3b2;line-height:1.6;margin-bottom:24px;">
            Your free trial ends on <strong style="color:#f59e0b;">${formattedDate}</strong>.
            To keep your shop running on FixTray without interruption, please make sure you have a valid payment method on file.
          </p>
          <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:20px;margin-bottom:28px;">
            <div style="font-size:16px;font-weight:700;color:#f59e0b;margin-bottom:6px;">⏳ Trial ends: ${formattedDate}</div>
            <div style="color:#9aa3b2;font-size:14px;">After your trial, paid access will begin automatically.</div>
          </div>
          <a href="${settingsUrl}" style="display:block;background:#e5332a;color:white;padding:14px;text-align:center;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:16px;">
            Manage Billing
          </a>
          <p style="color:#6b7280;font-size:12px;text-align:center;line-height:1.6;">
            Questions? Reply to this email or contact support.<br/>
            <a href="${appUrl}" style="color:#e5332a;">fixtray.app</a>
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Send an email verification link to a newly registered customer.
 * The raw token is embedded in the link; the DB stores only its SHA-256 hash.
 */
export async function sendVerificationEmail(toEmail: string, firstName: string, rawToken: string): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${rawToken}`;
  return sendEmail({
    to: toEmail,
    subject: 'Verify your FixTray email address',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#e5332a,#c0392b);padding:32px;text-align:center;">
          <div style="font-size:36px;font-weight:900;color:white;letter-spacing:-1px;">FixTray</div>
          <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:6px;">Email Verification</div>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#e5e7eb;margin:0 0 12px;">Hi ${firstName},</h2>
          <p style="color:#9aa3b2;line-height:1.6;margin-bottom:24px;">
            Thanks for signing up! Please verify your email address to get the most out of FixTray.
            This link expires in <strong style="color:#e5e7eb;">24 hours</strong>.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:#e5332a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:24px;">
            Verify Email Address
          </a>
          <p style="color:#6b7280;font-size:12px;margin-top:24px;line-height:1.6;">
            If you didn't sign up for FixTray, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}