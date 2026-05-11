// ============================================
// SUPPORT OPERATIONS PORTAL - MAIN SERVER
// ============================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ============================================
// MIDDLEWARE (tells Express how to handle data)
// ============================================

app.use(express.json()); // Parse incoming JSON data
app.use(express.static('public')); // Serve HTML/CSS files from 'public' folder


// Serve dashboard as default homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));


// ============================================
// AI CLASSIFICATION ENGINE (Rule-based)
// ============================================

function classifyTicket(description, schoolName) {
  description = description.toLowerCase();
  
  // Rule 1: Technical Issues
  if (description.includes('cannot access') || 
      description.includes('portal') || 
      description.includes('login') ||
      description.includes('password') ||
      description.includes('system down')) {
    return {
      category: 'Technical Issue',
      priority: 'High',
      queue: 'technical_support',
      sla_hours: 2
    };
  }
  
  // Rule 2: Billing Issues
  if (description.includes('charge') || 
      description.includes('bill') || 
      description.includes('payment') ||
      description.includes('invoice')) {
    return {
      category: 'Billing',
      priority: 'Medium',
      queue: 'finance_team',
      sla_hours: 4
    };
  }
  
  // Rule 3: Exam/Results Issues
  if (description.includes('exam') || 
      description.includes('result') || 
      description.includes('grade') ||
      description.includes('score')) {
    return {
      category: 'Results Inquiry',
      priority: 'Medium',
      queue: 'school_support',
      sla_hours: 6
    };
  }
  
  // Rule 4: Registration Issues
  if (description.includes('register') || 
      description.includes('candidate') || 
      description.includes('enrol')) {
    return {
      category: 'Candidate Registration',
      priority: 'Medium',
      queue: 'registration_team',
      sla_hours: 8
    };
  }
  
  // Default: General Inquiry
  return {
    category: 'General Inquiry',
    priority: 'Low',
    queue: 'general_support',
    sla_hours: 24
  };
}

// ============================================
// API ENDPOINT: Create Ticket
// ============================================

app.post('/tickets/create', (request, response) => {
  try {
    // 1. Extract ticket data from the form
    const { school_name, issue_type, priority_override, description } = request.body;
    
    // 2. Validate required fields
    if (!school_name || !description) {
      return response.status(400).json({
        success: false,
        error: 'School name and description required'
      });
    }
    
    // 3. Generate ticket ID
    const ticket_id = 'TKT-' + Date.now();
    
    // 4. RUN AI CLASSIFICATION
    const aiClassification = classifyTicket(description, school_name);
    
    // 5. Determine final priority (user can override)
    const finalPriority = priority_override || aiClassification.priority;
    
    // 6. Calculate SLA deadline
    const submitted_at = new Date().toISOString();
    const sla_deadline = new Date(Date.now() + aiClassification.sla_hours * 60 * 60 * 1000).toISOString();
    
    // 7. Create ticket object
    const ticket = {
      ticket_id,
      school_name,
      issue_type,
      description,
      ai_category: aiClassification.category,
      ai_priority: aiClassification.priority,
      ai_queue: aiClassification.queue,
      final_priority: finalPriority,
      sla_hours: aiClassification.sla_hours,
      sla_deadline,
      status: 'open',
      submitted_at,
      agent_assigned: null,
      summary: null,
      resolution: null
    };
    
    // 8. Save ticket to JSON file
    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    let tickets = [];
    
    if (fs.existsSync(ticketsFilePath)) {
      const fileContent = fs.readFileSync(ticketsFilePath, 'utf-8');
      tickets = JSON.parse(fileContent);
    }
    
    tickets.push(ticket);
    fs.writeFileSync(ticketsFilePath, JSON.stringify(tickets, null, 2));
    
    // 9. Log the automation action
    const logsFilePath = path.join(__dirname, 'logs', 'automation.json');
    let logs = [];
    
    if (fs.existsSync(logsFilePath)) {
      const fileContent = fs.readFileSync(logsFilePath, 'utf-8');
      logs = JSON.parse(fileContent);
    }
    
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'ticket_created',
      ticket_id,
      ai_classification: aiClassification.category,
      routed_to: aiClassification.queue,
      sla_hours: aiClassification.sla_hours
    });
    
    fs.writeFileSync(logsFilePath, JSON.stringify(logs, null, 2));
    
    // 10. Send success response
    response.status(201).json({
      success: true,
      ticket_id,
      message: `Ticket created and routed to ${aiClassification.queue}`,
      ai_insights: {
        category: aiClassification.category,
        priority: finalPriority,
        queue: aiClassification.queue,
        sla_hours: aiClassification.sla_hours
      }
    });
    
  } catch (error) {
    console.error('Error creating ticket:', error);
    response.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

// ============================================
// API ENDPOINT: Get All Tickets (for dashboard)
// ============================================

app.get('/tickets/list', (request, response) => {
  try {
    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    
    if (!fs.existsSync(ticketsFilePath)) {
      return response.json([]);
    }
    
    const fileContent = fs.readFileSync(ticketsFilePath, 'utf-8');
    const tickets = JSON.parse(fileContent);
    response.json(tickets);
    
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// API ENDPOINT: Get Logs (for audit trail)
// ============================================

app.get('/logs', (request, response) => {
  try {
    const logsFilePath = path.join(__dirname, 'logs', 'automation.json');
    
    if (!fs.existsSync(logsFilePath)) {
      return response.json([]);
    }
    
    const fileContent = fs.readFileSync(logsFilePath, 'utf-8');
    const logs = JSON.parse(fileContent);
    response.json(logs);
    
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`✅ Support Operations Portal running on port ${PORT}`);
  console.log(`📝 Submit tickets at: http://localhost:${PORT}`);
  console.log(`📊 View all tickets at: http://localhost:${PORT}/tickets/list`);
  console.log(`📋 View logs at: http://localhost:${PORT}/logs`);
});

// ============================================
// MODULE 2 — AI Ticket Summarization
// ============================================

function summarizeTicket(ticket) {
  // Rule-based summarizer — reads ticket fields and builds a plain-English summary
  const category = ticket.ai_category || ticket.issue_type || 'General';
  const priority = ticket.final_priority || ticket.ai_priority || 'Medium';
  const school = ticket.school_name || 'Unknown school';
  const desc = ticket.description || '';

  // Truncate long descriptions to first 100 characters for the summary
  const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;

  return `${school} submitted a ${category} ticket (${priority} priority). Issue: "${shortDesc}" — Routed to ${ticket.ai_queue || 'support'} queue. SLA: ${ticket.sla_hours || 24} hours.`;
}

app.get('/tickets/:id/summary', (request, response) => {
  try {
    const { id } = request.params;  // grabs the ticket ID from the URL

    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    if (!fs.existsSync(ticketsFilePath)) {
      return response.status(404).json({ error: 'No tickets found' });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFilePath, 'utf-8'));
    const ticket = tickets.find(t => t.ticket_id === id);

    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found' });
    }

    const summary = summarizeTicket(ticket);

    response.json({
      ticket_id: id,
      summary,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// MODULE 3 — AI Suggested Responses
// ============================================

function suggestResponse(ticket) {
  const category = ticket.ai_category || '';
  const priority = ticket.final_priority || ticket.ai_priority || 'Medium';
  const school = ticket.school_name || 'your school';

  // Each category gets a tailored draft response
  const templates = {
    'Technical Issue': `Dear ${school} team,\n\nThank you for contacting us. We have received your technical support request and our team is investigating urgently.\n\nExpected resolution: ${ticket.sla_hours || 2} hours.\n\nWe will keep you updated. Please do not submit duplicate tickets.\n\nBest regards,\nSupport Team`,

    'Billing': `Dear ${school} team,\n\nThank you for reaching out regarding your billing concern. Our finance team has been notified and will review your account within ${ticket.sla_hours || 4} hours.\n\nIf this is urgent, please reference ticket ID: ${ticket.ticket_id}.\n\nBest regards,\nFinance Support Team`,

    'Results Inquiry': `Dear ${school} team,\n\nWe have received your results inquiry. Our school support team will review the details and respond within ${ticket.sla_hours || 6} hours.\n\nPlease ensure all candidate details are included for faster resolution.\n\nBest regards,\nSchool Support Team`,

    'Candidate Registration': `Dear ${school} team,\n\nYour registration query has been logged. Our registration team will process this within ${ticket.sla_hours || 8} hours.\n\nPlease have candidate IDs ready when we contact you.\n\nBest regards,\nRegistration Team`,

    'General Inquiry': `Dear ${school} team,\n\nThank you for contacting us. A member of our support team will review your inquiry and respond within ${ticket.sla_hours || 24} hours.\n\nBest regards,\nCustomer Support`
  };

  return templates[category] || templates['General Inquiry'];
}

app.get('/tickets/:id/suggest-response', (request, response) => {
  try {
    const { id } = request.params;

    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    if (!fs.existsSync(ticketsFilePath)) {
      return response.status(404).json({ error: 'No tickets found' });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFilePath, 'utf-8'));
    const ticket = tickets.find(t => t.ticket_id === id);

    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found' });
    }

    const suggestedText = suggestResponse(ticket);

    response.json({
      ticket_id: id,
      suggested_response: suggestedText,
      based_on_category: ticket.ai_category,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// MODULE 4 — Salesforce CRM Sync Simulator
// ============================================

function transformToSalesforce(ticket) {
  // This is the PAYLOAD TRANSFORMATION — a key concept to show interviewers
  // It maps your internal ticket fields to "Salesforce-style" field names
  return {
    accountName: ticket.school_name,
    caseNumber: ticket.ticket_id,
    caseOrigin: 'Support Portal',
    subject: ticket.ai_category || ticket.issue_type,
    priority: ticket.final_priority,
    status: ticket.status === 'open' ? 'New' : 'In Progress',
    description__c: ticket.description,
    aiClassification__c: ticket.ai_category,
    aiSummary__c: summarizeTicket(ticket),
    slaDeadline__c: ticket.sla_deadline,
    queueName__c: ticket.ai_queue,
    createdDate: ticket.submitted_at
  };
}

app.post('/crm/sync/:id', (request, response) => {
  try {
    const { id } = request.params;

    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    if (!fs.existsSync(ticketsFilePath)) {
      return response.status(404).json({ error: 'No tickets found' });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFilePath, 'utf-8'));
    const ticket = tickets.find(t => t.ticket_id === id);

    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found' });
    }

    // Show the transformation side-by-side
    const original = { school_name: ticket.school_name, ticket_id: ticket.ticket_id };
    const salesforcePayload = transformToSalesforce(ticket);

    // Save CRM record locally (simulating a Salesforce upsert)
    const crmFilePath = path.join(__dirname, 'data', 'crm_records.json');
    let records = [];
    if (fs.existsSync(crmFilePath)) {
      records = JSON.parse(fs.readFileSync(crmFilePath, 'utf-8'));
    }

    // Upsert: update if exists, otherwise add
    const existingIndex = records.findIndex(r => r.caseNumber === id);
    if (existingIndex >= 0) {
      records[existingIndex] = salesforcePayload;
    } else {
      records.push(salesforcePayload);
    }
    fs.writeFileSync(crmFilePath, JSON.stringify(records, null, 2));

    response.json({
      success: true,
      message: 'CRM record synced successfully',
      original_payload: original,
      salesforce_payload: salesforcePayload,
      sync_timestamp: new Date().toISOString()
    });

  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/crm/records', (request, response) => {
  try {
    const crmFilePath = path.join(__dirname, 'data', 'crm_records.json');
    if (!fs.existsSync(crmFilePath)) return response.json([]);
    const records = JSON.parse(fs.readFileSync(crmFilePath, 'utf-8'));
    response.json(records);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// MODULE 5 — Dashboard Stats
// ============================================

app.get('/dashboard/stats', (request, response) => {
  try {
    const ticketsFilePath = path.join(__dirname, 'data', 'tickets.json');
    if (!fs.existsSync(ticketsFilePath)) {
      return response.json({ total: 0, open: 0, urgent: 0, breached: 0, byCategory: {} });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFilePath, 'utf-8'));
    const now = new Date();

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      urgent: tickets.filter(t => t.final_priority === 'Urgent').length,
      breached: tickets.filter(t => new Date(t.sla_deadline) < now && t.status === 'open').length,
      byCategory: {}
    };

    // Count tickets per AI category
    tickets.forEach(t => {
      const cat = t.ai_category || 'Unknown';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    response.json(stats);

  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});