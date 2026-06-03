import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  metadata?: Json;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationParams) {
  const { error } = await supabase.from("notifications").insert([{
    user_id: userId,
    type,
    title,
    message,
    link,
    metadata,
  }]);

  if (error) {
    console.error("Error creating notification:", error);
  }

  return !error;
}

export async function notifyTaskAssigned(
  assigneeUserId: string,
  taskTitle: string,
  taskId: string,
  leadId?: string | null
) {
  return createNotification({
    userId: assigneeUserId,
    type: "task_assigned",
    title: "Ny uppgift tilldelad",
    message: taskTitle,
    link: leadId ? `/leads/${leadId}` : "/tasks",
    metadata: { task_id: taskId, lead_id: leadId } as Json,
  });
}

export async function notifyLeadAssigned(
  assigneeUserId: string,
  leadName: string,
  leadId: string
) {
  return createNotification({
    userId: assigneeUserId,
    type: "lead_assigned",
    title: "Ny lead tilldelad",
    message: leadName,
    link: `/leads/${leadId}`,
    metadata: { lead_id: leadId } as Json,
  });
}

export async function notifyEmailOpened(
  userId: string,
  recipientName: string,
  recipientEmail: string,
  subject: string,
  leadId?: string | null
) {
  return createNotification({
    userId,
    type: "email_opened",
    title: "Mail öppnat",
    message: `${recipientName || recipientEmail} öppnade "${subject}"`,
    link: leadId ? `/leads/${leadId}` : "/outreach",
    metadata: { 
      recipient_email: recipientEmail, 
      subject,
      lead_id: leadId 
    } as Json,
  });
}

export async function notifySequenceStepStarted(
  userId: string,
  sequenceName: string,
  stepNumber: number,
  totalSteps: number,
  leadName: string,
  leadId: string
) {
  return createNotification({
    userId,
    type: "sequence_step_started",
    title: "Nytt sekvenssteg påbörjat",
    message: `Steg ${stepNumber}/${totalSteps} för ${leadName} i "${sequenceName}"`,
    link: `/leads/${leadId}`,
    metadata: { 
      sequence_name: sequenceName,
      step_number: stepNumber,
      total_steps: totalSteps,
      lead_id: leadId 
    } as Json,
  });
}

export async function notifySequenceCompleted(
  userId: string,
  sequenceName: string,
  leadName: string,
  leadId: string
) {
  return createNotification({
    userId,
    type: "sequence_completed",
    title: "Sekvens slutförd",
    message: `Sekvensen "${sequenceName}" för ${leadName} är nu klar`,
    link: `/leads/${leadId}`,
    metadata: { 
      sequence_name: sequenceName,
      lead_id: leadId 
    } as Json,
  });
}

export async function notifyEmailNeedsApproval(
  userId: string,
  sequenceName: string,
  leadName: string,
  leadId: string
) {
  return createNotification({
    userId,
    type: "email_needs_approval",
    title: "Mail väntar på godkännande",
    message: `Ett mail i "${sequenceName}" för ${leadName} behöver godkännas`,
    link: "/outreach",
    metadata: { 
      sequence_name: sequenceName,
      lead_id: leadId 
    } as Json,
  });
}
