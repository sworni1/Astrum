import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { RabbitPublisher } from "./rabbit.publisher";

@Module({
  providers: [RabbitPublisher, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
