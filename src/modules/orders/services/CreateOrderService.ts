import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);
    if (!customerExist) {
      throw new AppError('Could not find any customer with the give id');
    }

    const productsExist = await this.productsRepository.findAllById(products);
    if (!productsExist.length) {
      throw new AppError('Could not find any products with the give ids');
    }

    const productsExistIds = productsExist.map(product => product.id);

    const checkIndexProducts = products.filter(
      product => !productsExistIds.includes(product.id),
    );

    if (checkIndexProducts.length) {
      throw new AppError(`Could not find product ${checkIndexProducts[0].id}`);
    }

    const findProductQuantityAvailable = products.filter(
      product =>
        productsExist.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );
    if (findProductQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductQuantityAvailable[0].quantity} is not available for ${findProductQuantityAvailable[0].id}`,
      );
    }

    const serializeProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExist.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: serializeProducts,
    });

    const { order_products } = order;

    const ordersProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productsExist.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(ordersProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
