// src/modules/calendar/services/calendar.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  EventStatus,
  EventVisibility,
  AttendeeStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  QueryCalendarEventDto,
  CreateAttendeeDto,
  UpdateAttendeeStatusDto,
} from '../dto/calendar.dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async createEvent(organizationId: string, organizerId: string, dto: CreateCalendarEventDto) {
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        organizationId,
        organizerId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: start,
        endAt: end,
        allDay: dto.allDay ?? false,
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule,
        color: dto.color,
        visibility: dto.visibility ?? EventVisibility.TEAM,
        status: dto.status ?? EventStatus.CONFIRMED,
        contactId: dto.contactId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        // Add initial attendees
        attendees: dto.attendees?.length
          ? {
              create: dto.attendees.map((a) => ({
                userId: a.userId,
                email: a.email,
                name: a.name,
                status: AttendeeStatus.PENDING,
              })),
            }
          : undefined,
      },
      include: { attendees: true },
    });

    // Real-time broadcast to all org members
    this.notifications.broadcastToOrg(organizationId, 'calendar:event-created', {
      eventId: event.id,
      title: event.title,
      startAt: event.startAt,
    });

    this.logger.log(`Event created: ${event.id} "${event.title}" in org ${organizationId}`);
    return event;
  }

  async findEvents(organizationId: string, userId: string, query: QueryCalendarEventDto) {
    const where: Prisma.CalendarEventWhereInput = {
      organizationId,
      // Respect visibility: private events only shown to organizer
      OR: [{ visibility: { not: EventVisibility.PRIVATE } }, { organizerId: userId }],
      ...(query.from && { startAt: { gte: new Date(query.from) } }),
      ...(query.to && { endAt: { lte: new Date(query.to) } }),
      ...(query.organizerId && { organizerId: query.organizerId }),
      ...(query.contactId && { contactId: query.contactId }),
      ...(query.status && { status: query.status }),
      ...(query.visibility && { visibility: query.visibility }),
    };

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        attendees: {
          select: { id: true, userId: true, email: true, name: true, status: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(organizationId: string, eventId: string, userId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, organizationId },
      include: { attendees: true },
    });

    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Private events only accessible to organizer
    if (event.visibility === EventVisibility.PRIVATE && event.organizerId !== userId) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    return event;
  }

  async updateEvent(
    organizationId: string,
    eventId: string,
    userId: string,
    dto: UpdateCalendarEventDto,
  ) {
    const event = await this.findOne(organizationId, eventId, userId);

    if (dto.startAt && dto.endAt) {
      const start = new Date(dto.startAt);
      const end = new Date(dto.endAt);
      if (end <= start) throw new BadRequestException('End time must be after start time');
    }

    const updated = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
      include: { attendees: true },
    });

    // Notify all attendees of update via Socket.io
    this.notifications.broadcastToOrg(organizationId, 'calendar:event-updated', {
      eventId: updated.id,
      title: updated.title,
      startAt: updated.startAt,
    });

    return updated;
  }

  async deleteEvent(organizationId: string, eventId: string, userId: string) {
    await this.findOne(organizationId, eventId, userId);

    await this.prisma.$transaction([
      this.prisma.eventAttendee.deleteMany({ where: { eventId } }),
      this.prisma.calendarEvent.delete({ where: { id: eventId } }),
    ]);

    this.notifications.broadcastToOrg(organizationId, 'calendar:event-deleted', { eventId });
    return { deleted: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ATTENDEES
  // ══════════════════════════════════════════════════════════════════════════

  async addAttendee(
    organizationId: string,
    eventId: string,
    userId: string,
    dto: CreateAttendeeDto,
  ) {
    await this.findOne(organizationId, eventId, userId);

    if (!dto.userId && !dto.email) {
      throw new BadRequestException('Either userId or email must be provided');
    }

    const attendee = await this.prisma.eventAttendee.create({
      data: {
        eventId,
        userId: dto.userId,
        email: dto.email,
        name: dto.name,
        status: AttendeeStatus.PENDING,
      },
    });

    // Notify internal user in real-time
    if (dto.userId) {
      await this.notifications.createNotification({
        organizationId,
        userId: dto.userId,
        type: NotificationType.CUSTOM,
        title: 'Meeting Invitation',
        body: `You have been invited to an event`,
        app: 'CALENDAR' as any,
        resourceType: 'CalendarEvent',
        resourceId: eventId,
      });
    }

    return attendee;
  }

  async updateAttendeeStatus(
    organizationId: string,
    eventId: string,
    attendeeId: string,
    userId: string,
    dto: UpdateAttendeeStatusDto,
  ) {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { id: attendeeId },
    });
    if (!attendee || attendee.eventId !== eventId) {
      throw new NotFoundException('Attendee not found');
    }
    // Only the attendee themselves can update their status
    if (attendee.userId && attendee.userId !== userId) {
      throw new BadRequestException('You can only update your own attendance status');
    }

    return this.prisma.eventAttendee.update({
      where: { id: attendeeId },
      data: { status: dto.status },
    });
  }

  async removeAttendee(organizationId: string, eventId: string, attendeeId: string) {
    await this.prisma.eventAttendee.delete({ where: { id: attendeeId } });
    return { removed: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MY UPCOMING EVENTS  (dashboard widget)
  // ══════════════════════════════════════════════════════════════════════════

  async getMyUpcoming(organizationId: string, userId: string, days: number = 7) {
    const from = new Date();
    const to = new Date(Date.now() + days * 86_400_000);

    return this.prisma.calendarEvent.findMany({
      where: {
        organizationId,
        startAt: { gte: from, lte: to },
        status: { not: EventStatus.CANCELLED },
        OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
      },
      include: { attendees: { select: { userId: true, name: true, status: true } } },
      orderBy: { startAt: 'asc' },
    });
  }
}
