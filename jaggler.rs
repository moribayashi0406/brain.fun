use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("EYBneqf153nZjsqXg9bv1oJMa3vq7opDcGqxELBVyfqd");

#[program]
pub mod solana_slot_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.owner = ctx.accounts.owner.key();
        global_state.setting_probabilities = [2000, 2000, 3000, 1500, 1000, 500];
        global_state.play_cost = 1_000_000; // 0.001 SOL in lamports
        Ok(())
    }

    pub fn update_probabilities(ctx: Context<UpdateProbabilities>, new_probabilities: [u32; 6]) -> Result<()> {
        require!(
            ctx.accounts.owner.key() == ctx.accounts.global_state.owner,
            ErrorCode::Unauthorized
        );
        let sum: u32 = new_probabilities.iter().sum();
        require!(sum == 10000, ErrorCode::InvalidProbabilities);
        ctx.accounts.global_state.setting_probabilities = new_probabilities;
        Ok(())
    }

    pub fn update_play_cost(ctx: Context<UpdatePlayCost>, new_cost: u64) -> Result<()> {
        require!(
            ctx.accounts.owner.key() == ctx.accounts.global_state.owner,
            ErrorCode::Unauthorized
        );
        ctx.accounts.global_state.play_cost = new_cost;
        Ok(())
    }

    pub fn create_user(ctx: Context<CreateUser>) -> Result<()> {
        let user_state = &mut ctx.accounts.user_state;
        user_state.owner = ctx.accounts.owner.key();
        user_state.setting = assign_setting(&ctx.accounts.global_state.setting_probabilities)?;
        user_state.play_count = 0;
        Ok(())
    }

    pub fn play(ctx: Context<Play>) -> Result<()> {
        let user_state = &mut ctx.accounts.user_state;
        require!(user_state.play_count < 1000, ErrorCode::MaxPlaysReached);

        // Transfer SOL from player to program account
        let play_cost = ctx.accounts.global_state.play_cost;
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.global_state.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, play_cost)?;

        let setting = user_state.setting;
        let result = play_game(setting)?;

        msg!("Play result: {:?}", result);

        user_state.play_count += 1;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 24 + 8)]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProbabilities<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePlayCost<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(init, seeds = [owner.key().as_ref()], bump, payer = owner, space = 8 + 32 + 1 + 4)]
    pub user_state: Account<'info, UserState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub global_state: Account<'info, GlobalState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub user_state: Account<'info, UserState>,
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GlobalState {
    pub owner: Pubkey,
    pub setting_probabilities: [u32; 6],
    pub play_cost: u64,
}

#[account]
pub struct UserState {
    pub owner: Pubkey,
    pub setting: u8,
    pub play_count: u32,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid probabilities")]
    InvalidProbabilities,
    #[msg("Max plays reached")]
    MaxPlaysReached,
}

fn assign_setting(probabilities: &[u32; 6]) -> Result<u8> {
    let mut rand = Clock::get()?.unix_timestamp as u32;
    rand = rand.wrapping_mul(1103515245).wrapping_add(12345);
    let random_value = rand % 10000;

    let mut cumulative = 0;
    for (i, &prob) in probabilities.iter().enumerate() {
        cumulative += prob;
        if random_value < cumulative {
            return Ok(i as u8 + 1);
        }
    }
    Ok(6) // Fallback to the last setting if something goes wrong
}

#[derive(Debug)]
enum GameResult {
    Grape,
    Cherry,
    Replay,
    BIG,
    REG,
    None,
}

fn play_game(setting: u8) -> Result<GameResult> {
    let probabilities = match setting {
        1 => [17007, 2614, 13717, 366, 244, 66052],
        2 => [17123, 2627, 13699, 369, 259, 65923],
        3 => [17241, 2717, 13717, 375, 297, 65653],
        4 => [17391, 2809, 13699, 394, 345, 65362],
        5 => [17391, 2807, 13333, 416, 372, 65681],
        6 => [17391, 2803, 13699, 436, 436, 65235],
        _ => return Err(ErrorCode::InvalidProbabilities.into()),
    };

    let mut rand = Clock::get()?.unix_timestamp as u32;
    rand = rand.wrapping_mul(1103515245).wrapping_add(12345);
    let random_value = rand % 100000;

    let mut cumulative = 0;
    for (i, &prob) in probabilities.iter().enumerate() {
        cumulative += prob;
        if random_value < cumulative {
            return Ok(match i {
                0 => GameResult::Grape,
                1 => GameResult::Cherry,
                2 => GameResult::Replay,
                3 => GameResult::BIG,
                4 => GameResult::REG,
                _ => GameResult::None,
            });
        }
    }
    Ok(GameResult::None)
}