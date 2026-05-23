import { useQuery } from '@tanstack/react-query';
import { calendarService } from '../services/calendarService';
import { startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useState } from 'react';
import { ScheduleEvent } from '../types';

export const useSchedule = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Google Calendar API time boundaries for the current viewed week
    const timeMin = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const timeMax = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday

    const { data: events, isLoading, isError } = useQuery({
        queryKey: ['schedule', timeMin.toISOString(), timeMax.toISOString()],
        queryFn: () => calendarService.getWeeklySchedule(timeMin, timeMax),
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const nextWeek = () => setCurrentDate(prev => addWeeks(prev, 1));
    const prevWeek = () => setCurrentDate(prev => subWeeks(prev, 1));
    const goToToday = () => setCurrentDate(new Date());

    // Group events by day of week (1 to 7, Monday to Sunday)
    const groupedEvents = new Map<number, ScheduleEvent[]>();
    for (let i = 1; i <= 7; i++) groupedEvents.set(i, []);

    if (events) {
        events.forEach(event => {
            let day = event.startTime.getDay(); // 0 = Sunday, 1 = Monday
            day = day === 0 ? 7 : day; // Remap Sunday to 7
            const dayEvents = groupedEvents.get(day) || [];
            dayEvents.push(event);
            groupedEvents.set(day, dayEvents);
        });
    }

    return { 
        events: events || [], 
        groupedEvents,
        isLoading, 
        isError, 
        nextWeek, 
        prevWeek, 
        goToToday,
        currentDate 
    };
};
