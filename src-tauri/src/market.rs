//! CoinGecko market data + price formatting. No UI code here.
use serde::{Deserialize, Serialize};

/// Supported quote currencies: (CoinGecko id, display prefix). Also the allowlist for user input.
pub const FIATS: &[(&str, &str)] = &[
    ("usd", "$"),
    ("eur", "€"),
    ("gbp", "£"),
    ("jpy", "¥"),
    ("cad", "CA$"),
    ("aud", "A$"),
    ("chf", "CHF "),
    ("brl", "R$"),
    ("inr", "₹"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sparkline {
    pub price: Vec<Option<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coin {
    pub id: String,
    pub symbol: String,
    pub name: String,
    #[serde(default)]
    pub image: Option<String>,
    pub current_price: Option<f64>,
    pub price_change_percentage_24h: Option<f64>,
    pub market_cap_rank: Option<u32>,
    pub sparkline_in_7d: Option<Sparkline>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Snapshot {
    pub vs: String,
    pub coins: Vec<Coin>,
    pub fetched_at: u64,
}

pub fn is_supported(vs: &str) -> bool {
    FIATS.iter().any(|(id, _)| *id == vs)
}

fn prefix(vs: &str) -> &'static str {
    FIATS.iter().find(|(id, _)| *id == vs).map_or("", |(_, p)| p)
}

fn group(n: u64) -> String {
    let digits = n.to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

/// Compact price for the tray title: whole units above 1,000, cents below.
pub fn format_price(value: f64, vs: &str) -> String {
    if value >= 1000.0 {
        format!("{}{}", prefix(vs), group(value.round() as u64))
    } else {
        format!("{}{value:.2}", prefix(vs))
    }
}

pub async fn fetch(client: &reqwest::Client, vs: &str) -> Result<Vec<Coin>, String> {
    if !is_supported(vs) {
        return Err(format!("Unsupported currency: {vs}"));
    }
    let url = format!(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency={vs}\
         &order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h"
    );
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|_| "Can't reach CoinGecko — check your connection".to_string())?;
    match res.status().as_u16() {
        200 => match res.json::<Vec<Coin>>().await {
            Ok(coins) if coins.is_empty() => Err("CoinGecko returned no coins".into()),
            Ok(coins) => Ok(coins),
            Err(e) => Err(format!("Unexpected data from CoinGecko: {e}")),
        },
        429 => Err("CoinGecko rate limit hit — retrying shortly".into()),
        code => Err(format!("CoinGecko returned HTTP {code}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tolerates_null_fields() {
        let raw = r#"[{"id":"x","symbol":"x","name":"X","image":null,"current_price":null,
            "price_change_percentage_24h":null,"market_cap_rank":null,"sparkline_in_7d":null}]"#;
        let coins: Vec<Coin> = serde_json::from_str(raw).unwrap();
        assert!(coins[0].image.is_none() && coins[0].current_price.is_none());
    }

    #[test]
    fn formats_tray_prices() {
        assert_eq!(format_price(63412.49, "usd"), "$63,412");
        assert_eq!(format_price(1_234_567.0, "jpy"), "¥1,234,567");
        assert_eq!(format_price(1000.0, "eur"), "€1,000");
        assert_eq!(format_price(999.994, "gbp"), "£999.99");
        assert_eq!(format_price(0.5, "chf"), "CHF 0.50");
    }

    #[test]
    fn rejects_unknown_currency() {
        assert!(is_supported("usd"));
        assert!(!is_supported("usd&evil=1"));
        assert!(!is_supported(""));
    }

    #[test]
    fn parses_coingecko_row_with_nulls() {
        let json = r#"[{"id":"bitcoin","symbol":"btc","name":"Bitcoin","image":"x",
            "current_price":1.5,"price_change_percentage_24h":null,"market_cap_rank":1,
            "sparkline_in_7d":{"price":[1.0,null,2.0]},"extra":"ignored"}]"#;
        let coins: Vec<Coin> = serde_json::from_str(json).unwrap();
        assert_eq!(coins[0].current_price, Some(1.5));
        assert_eq!(coins[0].sparkline_in_7d.as_ref().unwrap().price.len(), 3);
    }
}
