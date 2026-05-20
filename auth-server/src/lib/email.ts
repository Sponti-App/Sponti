import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Sponti <noreply@sponti.app>";

export const sendPasswordResetEmail = async (to: string, resetUrl: string) => {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: "Reset your Sponti password",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #171717;">Reset your password</h2>
                <p style="color: #404040;">We received a request to reset your Sponti password. Click the button below — the link expires in 15 minutes.</p>
                <a href="${resetUrl}"
                   style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #f8b187; color: #3a2418; text-decoration: none; border-radius: 10px; font-weight: 500;">
                    Reset password
                </a>
                <p style="color: #737373; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    });

    if (error) {
        throw new Error("Failed to send password reset email", { cause: { status: 500 } });
    }
};
