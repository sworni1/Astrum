import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'

import { AppModule as AuthAppModule } from '../src/app.module'

jest.setTimeout(30000)

describe('Auth -> api-astrum (e2e)', () => {
  let authApp: INestApplication
  let apiApp: unknown

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests')
    }

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-jwt-secret'
    }

    if (!process.env.AUTH_SERVICE_URL) {
      process.env.AUTH_SERVICE_URL = 'http://localhost:4580'
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile()

    authApp = moduleFixture.createNestApplication()
    authApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    )
    await authApp.init()

    apiApp = require('../../api-astrum/src/app').default
  })

  afterAll(async () => {
    if (authApp) await authApp.close()
  })

  it('returns 401 when __auth cookie is missing', async () => {
    await request(apiApp)
      .get('/api/users/me')
      .expect(401)
  })

  it('authenticates in auth-astrum and accesses protected endpoints in api-astrum', async () => {
    const email = `test_${Date.now()}@example.com`
    const password = 'qwertyuiop'
    const gender = 'Male'
    const dateOfBirth = '2000-01-01T00:00:00.000Z'

    await request(authApp.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        gender,
        dateOfBirth,
        nickName: 'TestUser',
      })
      .expect(200)

    const signinResponse = await request(authApp.getHttpServer())
      .post('/api/auth/signin')
      .send({
        email,
        password,
      })
      .expect(200)

    const token = signinResponse.body?.token
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)

    const cookie = `__auth=${token}`

    const userResponse = await request(apiApp)
      .get('/api/users/me')
      .set('Cookie', cookie)
      .expect(200)

    expect(userResponse.body?.email).toBe(email)

    const wishlistResponse = await request(apiApp)
      .get('/api/wishlist')
      .set('Cookie', cookie)
      .expect(200)

    expect(Array.isArray(wishlistResponse.body)).toBe(true)

    const cartResponse = await request(apiApp)
      .get('/api/cart')
      .set('Cookie', cookie)
      .expect(200)

    expect(Array.isArray(cartResponse.body)).toBe(true)

    const ordersResponse = await request(apiApp)
      .get('/api/orders')
      .set('Cookie', cookie)
      .expect(200)

    expect(Array.isArray(ordersResponse.body)).toBe(true)
  })
})

