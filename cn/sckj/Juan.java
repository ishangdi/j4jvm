package cn.sckj;

public class Juan {
	public int test(int s_a) {
		s_a++;
		return s_a;
	}

	public static void main(String[] args) {
		System.out.println("hello world");
	}

	public void speak(int s_len) {
		for(int i = 0; i < s_len; i++) {
			System.out.println(i + " " + s_len);
		}
	}

}