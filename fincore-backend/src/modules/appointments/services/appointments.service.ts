// src/modules/appointments/services/appointments.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AppointmentStatus, NotificationType, Prisma } from '@prisma/client';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  QueryAppointmentDto,
} from '../dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async create(organizationId: string, ownerId: string, dto: CreateAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Appointment must be scheduled in the future');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        organizationId,
        ownerId,
        contactId: dto.contactId,
        title: dto.title,
        notes: dto.notes,
        scheduledAt,
        durationMinutes: dto.durationMinutes ?? 30,
        location: dto.location,
        meetingUrl: dto.meetingUrl,
        status: AppointmentStatus.SCHEDULED,
      },
      include: { contact: { select: { displayName: true, email: true } } },
    });

    // Real-time broadcast to org dashboard
    this.notifications.broadcastToOrg(organizationId, 'appointments:created', {
      appointmentId: appointment.id,
      title: appointment.title,
      scheduledAt: appointment.scheduledAt,
    });

    this.logger.log(`Appointment created: ${appointment.id} in org ${organizationId}`);
    return appointment;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findAll(organizationId: string, ownerId: string, query: QueryAppointmentDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      organizationId,
      ownerId,
      ...(query.status && { status: query.status }),
      ...(query.contactId && { contactId: query.contactId }),
      ...(query.from && { scheduledAt: { gte: new Date(query.from) } }),
      ...(query.to && { scheduledAt: { lte: new Date(query.to) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        include: { contact: { select: { displayName: true, email: true, phone: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id, organizationId },
      include: { contact: true },
    });
    if (!apt) throw new NotFoundException(`Appointment ${id} not found`);
    return apt;
  }

  async getUpcoming(organizationId: string, ownerId: string, days: number = 7) {
    return this.prisma.appointment.findMany({
      where: {
        organizationId,
        ownerId,
        status: AppointmentStatus.SCHEDULED,
        scheduledAt: {
          gte: new Date(),
          lte: new Date(Date.now() + days * 86_400_000),
        },
      },
      include: { contact: { select: { displayName: true, phone: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE / STATUS
  // ══════════════════════════════════════════════════════════════════════════

  async update(organizationId: string, id: string, dto: UpdateAppointmentDto) {
    await this.findOne(organizationId, id);

    const data: Prisma.AppointmentUpdateInput = {
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    };

    const updated = await this.prisma.appointment.update({ where: { id }, data });

    this.notifications.broadcastToOrg(organizationId, 'appointments:updated', {
      appointmentId: id,
      status: updated.status,
    });

    return updated;
  }

  async confirm(organizationId: string, id: string, ownerId: string) {
    const apt = await this.findOne(organizationId, id);
    if (apt.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException('Only SCHEDULED appointments can be confirmed');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED },
    });

    // Notify contact if they have a portal user linked
    if (apt.contactId) {
      const contact = await this.prisma.contact.findUnique({
        where: { id: apt.contactId },
        select: { portalUserId: true, displayName: true },
      });
      if (contact?.portalUserId) {
        await this.notifications.createNotification({
          organizationId,
          userId: contact.portalUserId,
          type: NotificationType.APPOINTMENT_REMINDER,
          title: 'Appointment Confirmed',
          body: `Your appointment "${apt.title}" has been confirmed`,
          app: 'APPOINTMENTS' as any,
          resourceType: 'Appointment',
          resourceId: id,
        });
      }
    }

    return updated;
  }

  async markCompleted(organizationId: string, id: string) {
    const apt = await this.findOne(organizationId, id);

    // FIX: TypeScript narrows AppointmentStatus as a wide enum type — passing
    // `apt.status` (AppointmentStatus) directly to Array<"CONFIRMED"|"SCHEDULED">.includes()
    // causes TS2345 because the argument type is wider than the array's element type.
    // Fix: declare the array with the correct element type explicitly.
    const completableStatuses: AppointmentStatus[] = [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
    ];
    if (!completableStatuses.includes(apt.status)) {
      throw new BadRequestException(
        'Appointment cannot be marked as completed from current status',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED },
    });
  }

  async markNoShow(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW },
    });
  }

  async cancel(organizationId: string, id: string, dto: CancelAppointmentDto) {
    const apt = await this.findOne(organizationId, id);
    if (apt.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.cancelReason,
      },
    });

    this.notifications.broadcastToOrg(organizationId, 'appointments:cancelled', {
      appointmentId: id,
    });

    return updated;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REMINDER CRON — runs every hour, notifies 24h and 1h before
  // ══════════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminderNotifications(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3_600_000);
    const window = 30 * 60_000; // 30-min window to avoid double sending

    // Find appointments in 24h window (not yet reminded)
    const upcoming24h = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        scheduledAt: { gte: new Date(in24h.getTime() - window), lte: in24h },
        reminderSentAt: null,
      },
      include: { contact: { select: { displayName: true } } },
    });

    for (const apt of upcoming24h) {
      try {
        await this.notifications.createNotification({
          organizationId: apt.organizationId,
          userId: apt.ownerId,
          type: NotificationType.APPOINTMENT_REMINDER,
          title: 'Appointment Tomorrow',
          body: `"${apt.title}" is scheduled for tomorrow at ${apt.scheduledAt.toLocaleTimeString()}`,
          app: 'APPOINTMENTS' as any,
          resourceType: 'Appointment',
          resourceId: apt.id,
        });

        await this.prisma.appointment.update({
          where: { id: apt.id },
          data: { reminderSentAt: new Date() },
        });
      } catch (err: unknown) {
        this.logger.error(`Reminder failed for apt ${apt.id}: ${(err as Error).message}`);
      }
    }

    this.logger.debug(`[Cron] Reminders sent: ${upcoming24h.length}`);
  }
}
