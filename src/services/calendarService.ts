import { env } from '../config/env';
import { ICalendarService, ScheduleEvent } from '../types';

export class CalendarService implements ICalendarService {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3/calendars';

  public async getWeeklySchedule(timeMin: Date, timeMax: Date): Promise<ScheduleEvent[]> {
    const configData = env.CALENDAR_CONFIG_DATA;
    if (!configData || !configData.apiKey || !configData.calendarId) {
      throw new Error('VITE_CALENDAR_CONFIG_DATA is missing or malformed.');
    }

    const { apiKey, calendarId, config, maxResults } = configData;
    
    // Construir la URL completa
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(calendarId)}/events`);
    
    // Configurar Query Params requeridos
    url.searchParams.append('key', apiKey);
    url.searchParams.append('timeMin', timeMin.toISOString());
    url.searchParams.append('timeMax', timeMax.toISOString());
    
    // Aplicar la configuración (singleEvents desglosa la recurrencia automáticamente si es true)
    if (config?.singleEvents) {
      url.searchParams.append('singleEvents', 'true');
    }
    
    if (config?.orderBy) {
      url.searchParams.append('orderBy', config.orderBy);
    }

    if (maxResults) {
      url.searchParams.append('maxResults', maxResults.toString());
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        let errorMessage = `Error en Google Calendar API: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            errorMessage += ` - ${errorData.error.message}`;
          }
        } catch {
          // Si no podemos parsear el error, ignoramos y usamos la frase por defecto
        }
        throw new Error(errorMessage);
      }

      const rawData = await response.json();
      const events = rawData.items || [];

      // Mapear los eventos al formato interno ScheduleEvent
      return events.map((item: any): ScheduleEvent => {
        // En Google Calendar v3 el título viene en 'summary'
        const title = item.summary || 'Evento sin título';
        const description = item.description || '';
        
        // Puede ocurrir que un evento dure todo el día en vez de tener dateTime (usa .date)
        const startRaw = item.start?.dateTime || item.start?.date;
        const endRaw = item.end?.dateTime || item.end?.date;
        
        // TODO: Agregar lógica personalizada para extraer un programId si lo hubiera en la descripción
        // por el momento podríamos extraerlo leyendo el principio
        let programId: string | undefined;
        if (description.includes('PROGRAM_ID:')) {
          const match = description.match(/PROGRAM_ID:\s*([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            programId = match[1];
          }
        }

        return {
          id: item.id,
          title,
          description,
          startTime: new Date(startRaw),
          endTime: new Date(endRaw),
          programId,
          color: item.colorId, // Google usa un colorId que luego se podría mapear
          recurrence: item.recurrence
        };
      });
      
    } catch (error) {
      // Registrar en consola el error exacto (útil para debug local)
      console.error('Error in CalendarService.getWeeklySchedule:', error);
      throw error; // Re-lanzar para que lo maneje TanStack Query o quien lo consuma
    }
  }
}

// Exportamos una instancia lista para usar
export const calendarService = new CalendarService();
