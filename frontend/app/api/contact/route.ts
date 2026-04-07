import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company, message } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Send email using Resend or Nodemailer
    // For now, just log and return success
    console.log('Contact form submission:', { name, email, company, message })

    // Simulate email sending
    // await resend.emails.send({
    //   from: 'contact@fincore.app',
    //   to: 'hello@fincore.app',
    //   subject: `New contact from ${name}`,
    //   html: `<p>Name: ${name}</p><p>Email: ${email}</p><p>Company: ${company || 'N/A'}</p><p>Message: ${message}</p>`,
    // })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}