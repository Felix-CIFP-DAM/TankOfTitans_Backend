import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Socket implements OnDestroy {
  private socket: ClientSocket | null = null;

  connect(url: string = 'http://localhost:3000', options?: any) {
    if (this.socket) return;
    this.socket = io(url, options);
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  on<T = any>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      if (!this.socket) {
        observer.error('Socket not connected');
        return;
      }
      const handler = (payload: T) => observer.next(payload);
      this.socket.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}