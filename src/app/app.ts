import { Component, OnInit, signal,OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Socket } from './sockets/socket';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  constructor(private Socket: Socket) {}

  ngOnInit() {
    this.Socket.connect('http://localhost:3000');
    this.Socket.on<any>('message').subscribe(msg => {
      console.log('mensaje recibido', msg);
    });
  }

  send() {
    this.Socket.emit('message', { text: 'hola' });
  }

  ngOnDestroy() {
    this.Socket.disconnect();
  }
}


