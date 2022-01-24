import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqplib from "amqplib/callback_api";

createConnection()
  .then((db) => {
    const productRepository = db.getMongoRepository(Product);

    amqplib.connect(
      "amqps://xvholbwb:Ct0aABJnd52M1RFzXgnQf6MH0xjsNsiA@roedeer.rmq.cloudamqp.com/xvholbwb",
      (error0, connection) => {
        if (error0) {
          throw error0;
        }

        connection.createChannel((error1, channel) => {
          if (error1) {
            throw error1;
          }

          const app = express();

          app.use(
            cors({
              origin: [
                "http://localhost:3000", //react
                "http://localhost:8080", //vuejs
                "http://localhost:4200", //angular
              ],
            })
          );

          app.use(express.json());

          //endpoints
          app.get("/api/products", async (req: Request, res: Response) => {
            const product = await productRepository.find();
            res.send(product);
          });

          app.post("/api/products", async (req: Request, res: Response) => {
            const product = await productRepository.create(req.body);
            const result = await productRepository.save(product);
            channel.sendToQueue(
              "product_created",
              Buffer.from(JSON.stringify(result))
            );

            return res.send(result);
          });

          app.get("/api/products/:id", async (req: Request, res: Response) => {
            const product = await productRepository.findOne(req.params.id);
            return res.send(product);
          });

          app.put("/api/products/:id", async (req: Request, res: Response) => {
            const product = await productRepository.findOne(req.params.id);
            productRepository.merge(product, req.body);
            const result = await productRepository.save(product);
            channel.sendToQueue(
              "product_updated",
              Buffer.from(JSON.stringify(result))
            );
            return res.send(result);
          });

          app.delete(
            "/api/products/:id",
            async (req: Request, res: Response) => {
              const result = await productRepository.delete(req.params.id);
              channel.sendToQueue(
                "product_deleted",
                Buffer.from(req.params.id)
              );
              return res.send(result);
            }
          );

          app.post(
            "/api/products/:id/like",
            async (req: Request, res: Response) => {
              const product = await productRepository.findOne(req.params.id);
              product.likes++;
              const result = await productRepository.save(product);
              return res.send(result);
            }
          );

          console.log("listening to port 8000");

          app.listen(8000);
          process.on("beforeExit", () => {
            console.log("closing");
            connection.close();
          });
        });
      }
    );
  })
  .catch((err) => console.log(err));
